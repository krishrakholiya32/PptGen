import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.user import User
from app.core.config import settings

password_hash = PasswordHash((Argon2Hasher(),))

# Single source of truth for the JWT secret — settings.JWT_SECRET_KEY (config.py
# fails fast at startup if it's still the dev default), so this module doesn't
# keep its own separate os.getenv lookup with a different fallback string.
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM  = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash(pw: str) -> str:
    return password_hash.hash(pw)

def _verify(plain: str, hashed: str) -> bool:
    return password_hash.verify(plain, hashed)

def _create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": exp}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            return None
        return await db.scalar(select(User).where(User.username == username))
    except jwt.InvalidTokenError:
        return None


async def require_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    user = await get_current_user(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", v):
            raise ValueError("Username must be 3-30 characters, letters/numbers/underscores only.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not 8 <= len(v) <= 128:
            raise ValueError("Password must be 8-128 characters.")
        if not re.search(r"[a-z]", v): raise ValueError("Password must include a lowercase letter.")
        if not re.search(r"[A-Z]", v): raise ValueError("Password must include an uppercase letter.")
        if not re.search(r"\d",   v): raise ValueError("Password must include a number.")
        if not re.search(r"[^A-Za-z0-9]", v): raise ValueError("Password must include a special character.")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if await db.scalar(select(User).where(User.username == req.username)):
        raise HTTPException(400, "Username already taken")
    if await db.scalar(select(User).where(User.email == req.email)):
        raise HTTPException(400, "Email already registered")
    user = User(username=req.username, email=req.email, password_hash=_hash(req.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=_create_token(user.username))


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == form.username))
    if not user or not _verify(form.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return TokenResponse(access_token=_create_token(user.username))


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(require_user)):
    return user


@router.get("/check")
async def check(username: Optional[str] = Query(None), email: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    result = {}
    if username is not None:
        v = username.strip()
        valid = bool(re.fullmatch(r"[A-Za-z0-9_]{3,30}", v))
        result["username"] = {"valid_format": valid, "taken": bool(valid and await db.scalar(select(User).where(User.username == v)))}
    if email is not None:
        v = email.strip()
        valid = bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v))
        result["email"] = {"valid_format": valid, "taken": bool(valid and await db.scalar(select(User).where(User.email == v)))}
    return result
