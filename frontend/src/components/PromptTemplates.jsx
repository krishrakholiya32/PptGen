export const PROMPT_TEMPLATES = [
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

export function PromptTemplates({ onSelect }) {
  return (
    <div className="prompt-templates">
      <p className="templates-label">Start with a template:</p>
      <div className="templates-grid">
        {PROMPT_TEMPLATES.map(t => (
          <button
            key={t.label}
            className="template-chip"
            onClick={() => onSelect(t.prompt)}
            title={t.prompt}
          >
            <span className="template-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
