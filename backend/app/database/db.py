from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Async engine (asyncpg driver). URL is normalized to the postgresql+asyncpg
# form by the fix_db_url validator in core.config, so Heroku-style
# postgres:// / postgresql:// URLs work unchanged.
engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    # Import models so they are registered on Base.metadata before create_all.
    from app.models.user import User  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
