import type { CSSProperties } from "react"

interface ChipColor {
  bg: string
  border: string
  text: string
}

// color assigned per chip for eye-pleasing variety
const CHIP_COLORS: ChipColor[] = [
  { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.35)",  text: "#a5b4fc" },  // indigo
  { bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.30)",  text: "#6ee7b7" },  // emerald
  { bg: "rgba(251,146,60,0.11)",  border: "rgba(251,146,60,0.32)",  text: "#fed7aa" },  // orange
  { bg: "rgba(59,130,246,0.11)",  border: "rgba(59,130,246,0.32)",  text: "#93c5fd" },  // blue
  { bg: "rgba(168,85,247,0.11)",  border: "rgba(168,85,247,0.32)",  text: "#d8b4fe" },  // purple
  { bg: "rgba(20,184,166,0.10)",  border: "rgba(20,184,166,0.30)",  text: "#99f6e4" },  // teal
  { bg: "rgba(234,179,8,0.10)",   border: "rgba(234,179,8,0.30)",   text: "#fde68a" },  // yellow
  { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.28)",   text: "#fca5a5" },  // red
]

interface PromptTemplate {
  icon: string
  label: string
  prompt: string
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    icon: "🚀",
    label: "Pitch Deck",
    prompt: "A startup pitch deck covering: problem we solve, our solution, market size and opportunity, product demo highlights, business model, traction and metrics, founding team, and funding ask.",
  },
  {
    icon: "📊",
    label: "Status Update",
    prompt: "A project status update presentation covering: executive summary, progress achieved this sprint, key metrics and KPIs, current blockers and risks, upcoming milestones, and next steps.",
  },
  {
    icon: "🎓",
    label: "Training",
    prompt: "A training presentation covering: learning objectives, key concepts explained simply, step-by-step guide with examples, common mistakes to avoid, hands-on exercise, and summary with key takeaways.",
  },
  {
    icon: "📈",
    label: "Sales Deck",
    prompt: "A sales deck covering: customer pain points, our solution and unique value proposition, key features and benefits, customer success stories, pricing overview, and call to action.",
  },
  {
    icon: "🔍",
    label: "Research Report",
    prompt: "A research report presentation covering: executive summary, research methodology, key findings, data analysis and charts, insights and implications, recommendations, and conclusion.",
  },
  {
    icon: "🗺️",
    label: "Roadmap",
    prompt: "A product roadmap presentation covering: vision and strategic goals, Q1-Q4 milestones, feature priorities, dependencies between teams, resource assignments, and success metrics.",
  },
  {
    icon: "💡",
    label: "Workshop",
    prompt: "A workshop presentation covering: workshop goals and agenda, icebreaker activity, core topic introduction, group exercise instructions, discussion facilitation guide, and action items.",
  },
  {
    icon: "🏢",
    label: "Company Overview",
    prompt: "A company overview presentation covering: mission and vision, founding story, products and services, target market, team and culture, achievements and milestones, and future direction.",
  },
]

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void
}

export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  return (
    <div className="prompt-templates">
      <p className="templates-label">Start with a template:</p>
      <div className="templates-grid">
        {PROMPT_TEMPLATES.map((t, i) => {
          const c = CHIP_COLORS[i % CHIP_COLORS.length]
          return (
            <button
              key={t.label}
              className="template-chip"
              style={{ "--chip-bg": c.bg, "--chip-border": c.border, "--chip-text": c.text } as CSSProperties}
              onClick={() => onSelect(t.prompt)}
              title={t.prompt}
            >
              <span className="template-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
