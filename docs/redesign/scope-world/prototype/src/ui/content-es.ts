// The prototype's content in Spanish. Same ids and shapes as the site's own
// modules (projects-content.ts, notebook-content.ts), whose types it reuses;
// the site itself is still in English and is not touched. If the site goes
// Spanish, this copy should move into those modules and this file go away.

import type { Project } from "../../../../../../src/components/sections/projects-content.ts"
import type { ResearchThread } from "../../../../../../src/components/sections/notebook-content.ts"

export const PROJECTS: readonly Project[] = [
  {
    id: "sport-coach",
    title: "Sport Coach",
    description:
      "Entrenamientos planificados por rotación, guiados con temporizadores en directo y un coach con IA que propone, pero nunca decide por ti. Scope es su identidad.",
    stack: ["Next.js", "TypeScript", "Supabase", "OpenAI"],
    links: [
      { label: "Ver la web", href: "#" },
      { label: "GitHub", href: "https://github.com/AlvaroGaertnerGit/sport-app" },
    ],
  },
  {
    id: "tournamently",
    title: "Tournamently",
    description:
      "Torneos de pádel organizados de principio a fin: cuadros, horarios y resultados en directo. La IA se encarga de lo que nadie quiere hacer a mano.",
    stack: ["Next.js", "TypeScript", "Supabase"],
    links: [
      { label: "Ver la web", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
  {
    id: "mathview",
    title: "MathView",
    description:
      "Un sitio para ver las matemáticas, no solo para leerlas. Lo hice para mis alumnos, que prefieren explorar una gráfica a pelearse con el libro de texto.",
    stack: ["Angular", "Python", "Matlab"],
    links: [
      { label: "Ver la web", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
]

export const NOTEBOOK_INTRO = {
  whisper: "Se suponía que no ibas a ver esto.",
  title: "Cuaderno abierto",
  subtitle: ["No son ideas terminadas.", "Son las preguntas que intento responder."],
} as const

export const RESEARCH_THREADS: readonly ResearchThread[] = [
  {
    id: "context-engineering",
    topic: "Ingeniería de contexto",
    currentQuestion: "¿Cuánto contexto basta de verdad?",
    status: "Probando",
    latestFinding: "El contexto escala mejor que los prompts.",
    currentHypothesis: "A partir de cierto punto, la arquitectura escala mejor que el contexto.",
    researchNotes: ["Necesito más pruebas antes de darlo por cerrado."],
    relatedIds: ["autonomous-engineering"],
  },
  {
    id: "ai-agents",
    topic: "Agentes de IA",
    currentQuestion: "¿Cuándo debería un agente de IA convertirse en dos?",
    status: "Investigando",
    currentHypothesis: "Repartir responsabilidades concretas funciona mejor que un único agente cargando con toda la tarea.",
    failedAssumption: "Pensaba que más instrucciones arreglarían la coordinación. No fue así.",
    nextExperiment: "Dar a dos agentes objetivos opuestos a propósito y ver quién cede.",
    relatedIds: ["mcp-ecosystem"],
  },
  {
    id: "mcp-ecosystem",
    topic: "Ecosistema MCP",
    currentQuestion: "¿Puede un protocolo común sustituir a un montón de integraciones hechas a medida?",
    status: "Empezando",
    researchNotes: [
      "Estoy conectando un navegador, un sistema de diseño y un gestor de proyectos con el mismo protocolo.",
      "Por ahora necesito menos adaptadores a medida de lo que esperaba.",
    ],
    relatedIds: ["ai-agents"],
  },
  {
    id: "local-models",
    topic: "Modelos locales",
    currentQuestion: "¿Dónde está la diferencia real de calidad entre un modelo local y uno de frontera?",
    status: "En pausa",
    latestFinding: "En tareas acotadas, es menor de lo que esperaba.",
    nextExperiment: "Lo retomaré cuando aparezca una tarea lo bastante aburrida como para justificarlo.",
  },
  {
    id: "ai-native-ux",
    topic: "UX nativa de IA",
    currentQuestion: "¿Se puede diseñar una interfaz a partir de lo que sabe hacer un modelo, en vez de pegarle un chat a un formulario?",
    status: "Construyendo",
    currentHypothesis: "El acompañante de esta web es el primer intento de verdad.",
    researchNotes: ["Sigue abierta una duda: si la interfaz recuerda por ti, ¿en qué momento deja de ser útil la memoria?"],
    relatedIds: ["context-engineering"],
  },
  {
    id: "autonomous-engineering",
    topic: "Ingeniería de software autónoma",
    currentQuestion: "¿Puede una IA entender la arquitectura en lugar de limitarse a generar código?",
    status: "Pensándolo",
    currentHypothesis: "La arquitectura escala mejor que el contexto.",
    failedAssumption: "Creía que más contexto podía sustituir a la estructura. Todavía lo estoy comprobando.",
    nextExperiment: "El ciclo de planificar, construir y revisar con el que hago esta web es, de momento, la prueba real más cercana.",
    relatedIds: ["context-engineering"],
  },
  {
    id: "next-question",
    topic: "···",
    unwritten: true,
  },
]
