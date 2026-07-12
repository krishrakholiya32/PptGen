// Shared domain types for the PptGen frontend.

export interface Theme {
  id: string
  name: string
  bg: string
  accent: string
  text: string
  preview: string[]
}

export interface Colors {
  bg: string
  accent: string
  text: string
}

export interface UploadedFiles {
  images: string[]
  templates: string[]
  documents: string[]
}

export interface User {
  id: number
  username: string
  email: string
  created_at: string
}

export interface Slide {
  title?: string
  bullets?: string[]
  speaker_notes?: string
  layout_type?: string
}

export interface SlidePlan {
  title?: string
  slides?: Slide[]
  // style carries theme colors plus arbitrary renderer-specific keys
  style?: { accent?: string; [key: string]: unknown }
}

export interface Job {
  status: string
  progress: number
  message: string
  download_url?: string
}

export interface HistoryEntry {
  job_id: string
  prompt: string
  slide_count: number
  created_at: string
  download_url: string
  expired?: boolean
}
