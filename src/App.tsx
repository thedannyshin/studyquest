import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  isMobileStudyDevice,
  isSessionAudioUnlocked,
  markSessionAudioUnlocked,
  primeVideoForSound,
  shouldDeferVideoAutoplay,
} from './videoAudio'
import {
  canListenForQuiz,
  canSpeakQuiz,
  ensureQuizAudioReady,
  getVoiceSession,
  isAudioSessionUnlocked,
  prefetchQuizAudio,
  speakQuiz,
  speakQuizFromGesture,
  speakText,
  startListeningForOption,
  stopSpeaking,
  unlockSpeechSynthesis,
  warmUpSpeechRecognition,
} from './voiceQuiz'
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Headphones,
  Home,
  Info,
  Link,
  Menu,
  MessageCircle,
  Network,
  Pause,
  PenTool,
  Play,
  Plus,
  Send,
  FileText,
  Search,
  User,
  Users,
  Video,
  VolumeX,
  X,
} from 'lucide-react'

type Screen = 'auth' | 'connect' | 'syncing' | 'feed'
type MainView = 'feed' | 'saved' | 'upload' | 'profile'
type SavedFilter = 'all' | 'video' | 'drill'
type AuthMode = 'login' | 'signup'
type Provider = 'Google Classroom' | 'Canvas'
type Modality = 'video' | 'drill'
type TopicStatus = 'needsWork' | 'learning' | 'mastered'

type Quiz = {
  type: 'multiple-choice' | 'fill'
  question: string
  options?: string[]
  answer: string
}

type Post = {
  id: number
  classCode: string
  title: string
  modality: Modality
  topic: string
  sourceLabel: string
  video?: string
  quiz?: Quiz
  privacy?: 'classmates' | 'only-me'
  postedBy?: string
  generatedFrom?: string
}

type UploadPrivacy = 'classmates' | 'only-me'
type UploadMode = 'video' | 'generate'
type StudyMode = 'active' | 'passive'

type GenerateSample = {
  id: string
  title: string
  materialLabel: string
  materialType: string
  classCode: string
  category: 'lecture' | 'reading'
  file: string
  video: string
}

const generateVideos = [
  '/How_System_Structure_Drives_Behavior_2.mp4',
  '/How_Mental_Models_Automate_Decisions_2.mp4',
  '/How_to_Reframe_Artificial_Constraints_2.mp4',
] as const

const generateSamples: GenerateSample[] = [
  {
    id: 'lecture-1-27',
    title: 'Systems Design: week of Jan 27',
    materialLabel: '1/27 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/1_27_Systems_Design.pdf',
    video: generateVideos[0],
  },
  {
    id: 'lecture-2-3',
    title: 'Systems Design: week of Feb 3',
    materialLabel: '2/3 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/2_3_Systems_Design.pdf',
    video: generateVideos[1],
  },
  {
    id: 'lecture-2-10',
    title: 'Systems Design: week of Feb 10',
    materialLabel: '2/10 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/2_10_Systems_Design.pdf',
    video: generateVideos[2],
  },
  {
    id: 'lecture-2-17',
    title: 'Systems Design: week of Feb 17',
    materialLabel: '2/17 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/2_17_Systems_Design.pdf',
    video: generateVideos[0],
  },
  {
    id: 'lecture-3-3',
    title: 'Systems Design: week of Mar 3',
    materialLabel: '3/3 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/3_3_Systems_Design.pdf',
    video: generateVideos[1],
  },
  {
    id: 'lecture-3-10',
    title: 'Systems Design: week of Mar 10',
    materialLabel: '3/10 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/3_10_Systems_Design.pdf',
    video: generateVideos[2],
  },
  {
    id: 'lecture-4-21',
    title: 'Systems Design: week of Apr 21',
    materialLabel: '4/21 Systems Design',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'lecture',
    file: '/materials/4_21_Systems_Design.pdf',
    video: generateVideos[0],
  },
  {
    id: 'rutherford-tools',
    title: 'Tools of systems thinkers',
    materialLabel: 'Tools of Systems Thinkers',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'reading',
    file: '/materials/Tools_of_Systems_Thinkers.pdf',
    video: generateVideos[1],
  },
  {
    id: 'bethune-closing-loop',
    title: 'Closing the loop for designers',
    materialLabel: 'Closing the Loop',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'reading',
    file: '/materials/Closing_the_Loop.pdf',
    video: generateVideos[2],
  },
  {
    id: 'meadows-thinking',
    title: 'Thinking in systems',
    materialLabel: 'Thinking in Systems (Meadows)',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'reading',
    file: '/materials/Thinking_in_Systems_Meadows.pdf',
    video: generateVideos[0],
  },
  {
    id: 'object-modeling',
    title: 'Object modeling and flow diagramming',
    materialLabel: 'Object Modeling and Flow Diagramming',
    materialType: 'PDF',
    classCode: 'Systems',
    category: 'reading',
    file: '/materials/Object_Modeling_and_Flow_Diagramming.pdf',
    video: generateVideos[1],
  },
]

const classes = ['Systems', 'Prototyping', 'Social Lab']

const classFilters = [
  { id: 'Systems', label: 'Systems', Icon: Network },
  { id: 'Prototyping', label: 'Prototyping', Icon: PenTool },
  { id: 'Social Lab', label: 'Social Lab', Icon: Users },
] as const

const posts: Post[] = [
  {
    id: 1,
    classCode: 'Systems',
    title: 'How system structure drives behavior',
    modality: 'video',
    topic: 'system-structure',
    sourceLabel: 'Thinking in Systems + Iceberg Model',
    video: '/How_System_Structure_Drives_Behavior_1.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 2,
    classCode: 'Systems',
    title: 'What primarily drives behavior in a system?',
    modality: 'drill',
    topic: 'system-structure',
    sourceLabel: 'Thinking in Systems + Iceberg Model',
    quiz: {
      type: 'multiple-choice',
      question: 'What primarily drives behavior in a system?',
      options: [
        'Individual intentions',
        'The system’s structure',
        'Random chance',
        'Short-term incentives only',
      ],
      answer: 'The system’s structure',
    },
  },
  {
    id: 3,
    classCode: 'Systems',
    title: 'How mental models automate decisions',
    modality: 'video',
    topic: 'mental-models',
    sourceLabel: 'Mental Models and Cluster Maps',
    video: '/How_Mental_Models_Automate_Decisions_1.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 4,
    classCode: 'Systems',
    title: 'Mental models help people make decisions by _____.',
    modality: 'drill',
    topic: 'mental-models',
    sourceLabel: 'Mental Models and Cluster Maps',
    quiz: {
      type: 'fill',
      question: 'Mental models help people make decisions by _____.',
      answer: 'automating',
    },
  },
  {
    id: 5,
    classCode: 'Systems',
    title: 'How connection circles reveal hidden systems',
    modality: 'video',
    topic: 'connection-circles',
    sourceLabel: 'Interconnected Circles Map',
    video: '/How_Connection_Circles_Reveal_Hidden_Systems_1.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 6,
    classCode: 'Systems',
    title: 'Connection circles: mapping the relationships',
    modality: 'video',
    topic: 'connection-circles',
    sourceLabel: 'Interconnected Circles Map',
    video: '/How_Connection_Circles_Reveal_Hidden_Systems_2.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 7,
    classCode: 'Systems',
    title: 'Connection circles are most useful for revealing:',
    modality: 'drill',
    topic: 'connection-circles',
    sourceLabel: 'Interconnected Circles Map',
    quiz: {
      type: 'multiple-choice',
      question: 'Connection circles are most useful for revealing:',
      options: [
        'Hidden relationships in a system',
        'Exact numerical forecasts',
        'A single root cause',
        'User interface layouts',
      ],
      answer: 'Hidden relationships in a system',
    },
  },
  {
    id: 8,
    classCode: 'Systems',
    title: 'How to reframe artificial constraints',
    modality: 'video',
    topic: 'constraints',
    sourceLabel: 'Leverage Points and Action to Outcome Maps',
    video: '/How_to_Reframe_Artificial_Constraints_1.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 9,
    classCode: 'Systems',
    title: 'An artificial constraint is often something we treat as fixed that is actually _____.',
    modality: 'drill',
    topic: 'constraints',
    sourceLabel: 'Leverage Points and Action to Outcome Maps',
    quiz: {
      type: 'fill',
      question: 'An artificial constraint is often something we treat as fixed that is actually _____.',
      answer: 'changeable',
    },
  },
  {
    id: 10,
    classCode: 'Systems',
    title: 'Why AI agents are killing traditional UX',
    modality: 'video',
    topic: 'ai-agents',
    sourceLabel: 'Experiment #2: AI Agents',
    video: '/Why_AI_Agents_Are_Killing_Traditional_UX_1.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 11,
    classCode: 'Systems',
    title: 'AI agents: designing for goals, not screens',
    modality: 'video',
    topic: 'ai-agents',
    sourceLabel: 'Experiment #2: AI Agents',
    video: '/Why_AI_Agents_Are_Killing_Traditional_UX_2.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 12,
    classCode: 'Systems',
    title: 'AI agents challenge traditional UX mainly by shifting focus from screens to:',
    modality: 'drill',
    topic: 'ai-agents',
    sourceLabel: 'Experiment #2: AI Agents',
    quiz: {
      type: 'multiple-choice',
      question: 'AI agents challenge traditional UX mainly by shifting focus from screens to:',
      options: [
        'Goals and outcomes',
        'Color palettes',
        'Pixel-perfect layouts',
        'Static wireframes only',
      ],
      answer: 'Goals and outcomes',
    },
  },
]

const assignment = {
  id: 'systems-ai-agents',
  classCode: 'Systems',
  title: 'Experiment #2: AI Agents',
  topics: ['ai-agents', 'system-structure', 'mental-models'],
}

const upcomingItems = [
  {
    id: 'up-1',
    type: 'Assignment',
    title: 'Experiment #2: AI Agents',
    classCode: 'Systems',
    due: 'Due Tue',
    dueOffset: 1,
    urls: {
      'Google Classroom': 'https://classroom.google.com',
      Canvas: 'https://canvas.instructure.com',
    },
  },
  {
    id: 'up-2',
    type: 'Assignment',
    title: 'Narrative Object Model: Current State',
    classCode: 'Systems',
    due: 'Due Tue',
    dueOffset: 1,
    urls: {
      'Google Classroom': 'https://classroom.google.com',
      Canvas: 'https://canvas.instructure.com',
    },
  },
  {
    id: 'up-3',
    type: 'Assignment',
    title: 'Leverage Points and Action to Outcome Maps',
    classCode: 'Systems',
    due: 'Due next week',
    dueOffset: 5,
    urls: {
      'Google Classroom': 'https://classroom.google.com',
      Canvas: 'https://canvas.instructure.com',
    },
  },
  {
    id: 'up-4',
    type: 'Assignment',
    title: '3/31 Case Study + Presentations',
    classCode: 'Systems',
    due: 'Due in 2 weeks',
    dueOffset: 12,
    urls: {
      'Google Classroom': 'https://classroom.google.com',
      Canvas: 'https://canvas.instructure.com',
    },
  },
] as const

const commentSeeds = [
  {
    name: 'Jordan S.',
    text: 'The connection circles example made the feedback loops click.',
    time: '12m',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Riley K.',
    text: 'Can someone explain leverage points vs. constraints again?',
    time: '8m',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'Taylor M.',
    text: 'The AI agents take is wild — totally reframed UX for me.',
    time: '3m',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
]

const SESSION_KEY = 'study-quest-session'
const SAVED_KEY = 'study-quest-saved'
const PROGRESS_KEY = 'study-quest-progress'
const ANSWERED_KEY = 'study-quest-answered'
const QUIZ_RESPONSES_KEY = 'study-quest-quiz-responses'
const STUDY_MODE_KEY = 'study-quest-study-mode'
const FEED_POSITION_KEY = 'study-quest-feed-position'
const LAST_FEED_CLASS_KEY = 'study-quest-feed-class'

type QuizResponses = Record<number, string>
type FeedPositions = Record<string, string>
type FeedItem =
  | { type: 'due'; items: (typeof upcomingItems)[number][] }
  | { type: 'assignment' }
  | { type: 'post'; post: Post }
  | { type: 'complete' }
const PROFILE_PHOTO = 'https://randomuser.me/api/portraits/women/68.jpg'
const PROFILE_NAME = 'Alex Morgan'
const PROFILE_EMAIL = 'alex@cca.edu'
const PROFILE_SCHOOL = 'California College of the Arts'

function formatPosterName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

function getVideoAttribution(postedBy?: string) {
  if (!postedBy || postedBy === 'StudyQuest AI') {
    return 'StudyQuest AI generated this video'
  }
  if (postedBy === PROFILE_NAME) {
    return 'You posted this video'
  }
  return `${formatPosterName(postedBy)} posted this video`
}

const providerUrls: Record<Provider, string> = {
  'Google Classroom': 'https://classroom.google.com',
  Canvas: 'https://canvas.instructure.com',
}

type SessionData = {
  signedIn?: boolean
  provider?: Provider | null
}

function readSession(): { screen: Screen; provider: Provider | null } {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { screen: 'auth', provider: null }
    const data = JSON.parse(raw) as SessionData
    if (data.signedIn) {
      return {
        screen: 'feed',
        provider: data.provider === 'Canvas' || data.provider === 'Google Classroom'
          ? data.provider
          : 'Google Classroom',
      }
    }
  } catch {
    // ignore bad session data
  }
  return { screen: 'auth', provider: null }
}

function writeSession(signedIn: boolean, provider: Provider | null) {
  if (!signedIn) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ signedIn: true, provider }))
}

function clearProgressStorage() {
  localStorage.removeItem(PROGRESS_KEY)
  localStorage.removeItem(ANSWERED_KEY)
  localStorage.removeItem(QUIZ_RESPONSES_KEY)
  localStorage.removeItem(FEED_POSITION_KEY)
  localStorage.removeItem(LAST_FEED_CLASS_KEY)
}

function readSavedIds(): number[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((id): id is number => typeof id === 'number')
  } catch {
    return []
  }
}

function writeSavedIds(ids: number[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids))
}

function readCompletedIds(): number[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((id): id is number => typeof id === 'number')
  } catch {
    return []
  }
}

function writeCompletedIds(ids: number[]) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(ids))
}

function readAnsweredIds(): number[] {
  try {
    const raw = localStorage.getItem(ANSWERED_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((id): id is number => typeof id === 'number')
  } catch {
    return []
  }
}

function writeAnsweredIds(ids: number[]) {
  localStorage.setItem(ANSWERED_KEY, JSON.stringify(ids))
}

function readQuizResponses(): QuizResponses {
  try {
    const raw = localStorage.getItem(QUIZ_RESPONSES_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const responses: QuizResponses = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const id = Number(key)
      if (Number.isFinite(id) && typeof value === 'string') responses[id] = value
    }
    return responses
  } catch {
    return {}
  }
}

function writeQuizResponses(responses: QuizResponses) {
  localStorage.setItem(QUIZ_RESPONSES_KEY, JSON.stringify(responses))
}

function readStudyMode(): StudyMode {
  try {
    return localStorage.getItem(STUDY_MODE_KEY) === 'passive' ? 'passive' : 'active'
  } catch {
    return 'active'
  }
}

function writeStudyMode(mode: StudyMode) {
  localStorage.setItem(STUDY_MODE_KEY, mode)
}

function mergeAnsweredIds(ids: number[], responses: QuizResponses) {
  const fromResponses = Object.keys(responses)
    .map((key) => Number(key))
    .filter((id) => Number.isFinite(id))
  return [...new Set([...ids, ...fromResponses])]
}

function readFeedPositions(): FeedPositions {
  try {
    const raw = localStorage.getItem(FEED_POSITION_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const positions: FeedPositions = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === 'string') positions[key] = value
    }
    return positions
  } catch {
    return {}
  }
}

function writeFeedPositions(positions: FeedPositions) {
  localStorage.setItem(FEED_POSITION_KEY, JSON.stringify(positions))
}

function readLastFeedClass() {
  try {
    return localStorage.getItem(LAST_FEED_CLASS_KEY) || 'All'
  } catch {
    return 'All'
  }
}

function getFeedItemKey(item: FeedItem, index: number) {
  if (item.type === 'post') return `post-${item.post.id}`
  if (item.type === 'due') return 'due-board'
  if (item.type === 'complete') return 'feed-complete'
  if (item.type === 'assignment') return 'assignment'
  return `slide-${index}`
}

function App() {
  const initialSession = useMemo(() => readSession(), [])
  const [screen, setScreen] = useState<Screen>(() => initialSession.screen)
  const [mainView, setMainView] = useState<MainView>('feed')
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [provider, setProvider] = useState<Provider | null>(() => initialSession.provider)
  const [syncProgress, setSyncProgress] = useState(0)
  const [selectedClass, setSelectedClass] = useState(() => readLastFeedClass())
  const [topicStatus, setTopicStatus] = useState<Record<string, TopicStatus>>({})
  const [topicCorrectStreak, setTopicCorrectStreak] = useState<Record<string, number>>({})
  const [assignmentOpened, setAssignmentOpened] = useState(false)
  const [assignmentSnoozed, setAssignmentSnoozed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [savedIds, setSavedIds] = useState<number[]>(() => readSavedIds())
  const [completedIds, setCompletedIds] = useState<number[]>(() => readCompletedIds())
  const [quizResponses, setQuizResponses] = useState<QuizResponses>(() => readQuizResponses())
  const [answeredIds, setAnsweredIds] = useState<number[]>(() => (
    mergeAnsweredIds(readAnsweredIds(), readQuizResponses())
  ))
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all')
  const [userPosts, setUserPosts] = useState<Post[]>([])
  const [uploadClass, setUploadClass] = useState(classes[0])
  const [uploadPrivacy, setUploadPrivacy] = useState<UploadPrivacy>('classmates')
  const [uploadMode, setUploadMode] = useState<UploadMode>('generate')
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadSampleId, setUploadSampleId] = useState<string | null>(null)
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerFilter, setPickerFilter] = useState<'all' | 'lecture' | 'reading'>('all')
  const [pickerHighlightId, setPickerHighlightId] = useState<string | null>(null)
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadGenerating, setUploadGenerating] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showAllDues, setShowAllDues] = useState(false)
  const [studyMode, setStudyMode] = useState<StudyMode>(() => readStudyMode())
  const [mobileStudy, setMobileStudy] = useState(() => isMobileStudyDevice())
  const [feedPositions, setFeedPositions] = useState<FeedPositions>(() => readFeedPositions())
  const feedRef = useRef<HTMLElement>(null)
  const restoreFeedRef = useRef(true)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const passiveMode = mobileStudy && studyMode === 'passive'

  useEffect(() => {
    if (screen === 'feed') writeSession(true, provider)
  }, [screen, provider])

  useEffect(() => {
    writeSavedIds(savedIds)
  }, [savedIds])

  useEffect(() => {
    writeCompletedIds(completedIds)
  }, [completedIds])

  useEffect(() => {
    writeAnsweredIds(answeredIds)
  }, [answeredIds])

  useEffect(() => {
    writeQuizResponses(quizResponses)
  }, [quizResponses])

  useEffect(() => {
    writeFeedPositions(feedPositions)
  }, [feedPositions])

  useEffect(() => {
    writeStudyMode(studyMode)
  }, [studyMode])

  useEffect(() => {
    const syncMobile = () => setMobileStudy(isMobileStudyDevice())
    syncMobile()
    window.addEventListener('resize', syncMobile)
    return () => window.removeEventListener('resize', syncMobile)
  }, [])

  useEffect(() => {
    if (!mobileStudy && studyMode === 'passive') setStudyMode('active')
  }, [mobileStudy, studyMode])

  useEffect(() => {
    if (passiveMode) {
      setCommentsOpen(false)
      setMobileNavOpen(false)
    }
  }, [passiveMode])

  useEffect(() => {
    restoreFeedRef.current = true
  }, [passiveMode])

  useEffect(() => {
    if (mainView !== 'upload') setUploadPickerOpen(false)
  }, [mainView])

  const sourceUrl = providerUrls[provider ?? 'Google Classroom']
  const providerLabel = provider ?? 'Google Classroom'
  const allPosts = useMemo(() => [...posts, ...userPosts], [userPosts])
  const savedPosts = useMemo(
    () => allPosts.filter((post) => savedIds.includes(post.id)),
    [allPosts, savedIds],
  )
  const filteredSavedPosts = useMemo(() => {
    if (savedFilter === 'all') return savedPosts
    return savedPosts.filter((post) => post.modality === savedFilter)
  }, [savedPosts, savedFilter])

  const classesWithPosts = useMemo(() => {
    return new Set(allPosts.map((post) => post.classCode))
  }, [allPosts])

  const classProgress = useMemo(() => {
    return classFilters.map(({ id, label, Icon }) => {
      const classPosts = allPosts.filter((post) => post.classCode === id)
      const videos = classPosts.filter((post) => post.modality === 'video')
      const quizzes = classPosts.filter((post) => post.modality === 'drill')
      const videosDone = videos.filter((post) => completedIds.includes(post.id)).length
      const quizzesDone = quizzes.filter((post) => answeredIds.includes(post.id)).length
      const total = videos.length + quizzes.length
      const done = videosDone + quizzesDone
      let status = 'Not started'
      if (total === 0) status = 'Coming soon'
      else if (done === total) status = 'All done'
      else if (done > 0) status = `${done} of ${total} done`
      return {
        id,
        label,
        Icon,
        total,
        done,
        status,
        percent: total === 0 ? 0 : Math.round((done / total) * 100),
      }
    })
  }, [allPosts, completedIds, answeredIds])

  const overallProgress = useMemo(() => {
    const total = classProgress.reduce((sum, item) => sum + item.total, 0)
    const done = classProgress.reduce((sum, item) => sum + item.done, 0)
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    }
  }, [classProgress])

  const markComplete = (postId: number) => {
    setCompletedIds((current) => (current.includes(postId) ? current : [...current, postId]))
  }

  const markAnswered = (postId: number) => {
    setAnsweredIds((current) => (current.includes(postId) ? current : [...current, postId]))
  }

  const saveQuizResponse = (postId: number, response: string) => {
    setQuizResponses((current) => (
      current[postId] === response ? current : { ...current, [postId]: response }
    ))
    markAnswered(postId)
  }

  const selectedGenerateSample = useMemo(
    () => generateSamples.find((sample) => sample.id === uploadSampleId) ?? null,
    [uploadSampleId],
  )

  const filteredGenerateSamples = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase()
    return generateSamples.filter((sample) => {
      if (pickerFilter !== 'all' && sample.category !== pickerFilter) return false
      if (!query) return true
      const haystack = `${sample.materialLabel} ${sample.materialType} ${sample.classCode} ${sample.category} ${sample.file}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [pickerSearch, pickerFilter])

  const openUploadPicker = () => {
    setPickerSearch('')
    setPickerFilter('all')
    setPickerHighlightId(uploadSampleId)
    setUploadPickerOpen(true)
  }

  const confirmGenerateSample = () => {
    const sample = generateSamples.find((item) => item.id === pickerHighlightId)
    if (!sample) return
    setUploadError('')
    setUploadSampleId(sample.id)
    setUploadClass(sample.classCode)
    setUploadPickerOpen(false)
  }

  const applyUploadFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('video/')) {
      setUploadError('Choose an MP4, WebM, or MOV video.')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const duration = probe.duration
      probe.removeAttribute('src')
      probe.load()
      if (!Number.isFinite(duration) || duration > 60) {
        URL.revokeObjectURL(objectUrl)
        setUploadError('Videos must be under 1 minute.')
        setUploadPreview(null)
        setUploadFileName('')
        if (uploadInputRef.current) uploadInputRef.current.value = ''
        return
      }
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
      setUploadError('')
      setUploadFileName(file.name)
      setUploadPreview(objectUrl)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setUploadError('Couldn’t read that video. Try another file.')
      setUploadPreview(null)
      setUploadFileName('')
    }
    probe.src = objectUrl
  }

  const switchUploadMode = (mode: UploadMode) => {
    if (mode === uploadMode) return
    setUploadMode(mode)
    setUploadError('')
    setUploadPickerOpen(false)
    if (mode === 'video') {
      setUploadSampleId(null)
    } else {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
      setUploadPreview(null)
      setUploadFileName('')
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  const resetUploadForm = () => {
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
    setUploadFileName('')
    setUploadSampleId(null)
    setUploadPickerOpen(false)
    setUploadClass(classes[0])
    setUploadPrivacy('classmates')
    setUploadError('')
    setUploadGenerating(false)
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  const toggleSaved = (postId: number) => {
    setSavedIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    )
  }

  const goToFeed = (nextProvider?: Provider) => {
    if (nextProvider) setProvider(nextProvider)
    else if (!provider) setProvider('Google Classroom')
    setMainView('feed')
    setScreen('feed')
  }

  const openFeedClass = (classCode: string) => {
    if (classCode !== 'All' && !classesWithPosts.has(classCode)) return
    setSelectedClass(classCode)
    setMainView('feed')
    setCommentsOpen(false)
    setMobileNavOpen(false)
    localStorage.setItem(LAST_FEED_CLASS_KEY, classCode)
  }

  const openMainView = (view: MainView) => {
    setMainView(view)
    setCommentsOpen(false)
    setMobileNavOpen(false)
  }

  const logOut = () => {
    clearProgressStorage()
    writeSession(false, null)
    setProvider(null)
    setCompletedIds([])
    setAnsweredIds([])
    setQuizResponses({})
    setFeedPositions({})
    setTopicStatus({})
    setTopicCorrectStreak({})
    setAssignmentOpened(false)
    setAssignmentSnoozed(false)
    setActiveIndex(0)
    setSelectedClass('All')
    setCommentsOpen(false)
    setShowAllDues(false)
    setMainView('feed')
    setScreen('auth')
    restoreFeedRef.current = true
  }

  const uploadReady =
    uploadMode === 'video'
      ? Boolean(uploadPreview && !uploadError && uploadClass && uploadPrivacy)
      : Boolean(uploadSampleId && !uploadError && uploadClass && uploadPrivacy && !uploadGenerating)

  const submitUpload = (event: FormEvent) => {
    event.preventDefault()
    if (!uploadReady) return

    const nextId = Math.max(0, ...allPosts.map((post) => post.id)) + 1
    const classCode = uploadClass
    const privacy = uploadPrivacy

    if (uploadMode === 'generate') {
      const sample = selectedGenerateSample
      if (!sample) return
      const materialName = `${sample.materialLabel} (${sample.materialType})`
      setUploadGenerating(true)
      window.setTimeout(() => {
        setUserPosts((current) => [
          {
            id: nextId,
            classCode,
            title: sample.title,
            modality: 'video',
            topic: 'uploaded',
            sourceLabel: materialName,
            video: sample.video,
            privacy,
            postedBy: 'StudyQuest AI',
            generatedFrom: materialName,
          },
          ...current,
        ])
        resetUploadForm()
        setSelectedClass(classCode)
        setMainView('feed')
      }, 1200)
      return
    }

    if (!uploadPreview) return
    const title = uploadFileName.replace(/\.[^.]+$/, '') || 'Untitled video'
    const videoUrl = uploadPreview
    setUserPosts((current) => [
      {
        id: nextId,
        classCode,
        title,
        modality: 'video',
        topic: 'uploaded',
        sourceLabel: 'Your upload',
        video: videoUrl,
        privacy,
        postedBy: PROFILE_NAME,
      },
      ...current,
    ])
    resetUploadForm()
    setSelectedClass(classCode)
    setMainView('feed')
  }

  const submitAuth = (event: FormEvent) => {
    event.preventDefault()
    if (authMode === 'signup') setScreen('connect')
    else goToFeed()
  }

  const startSync = (nextProvider: Provider) => {
    setProvider(nextProvider)
    setSyncProgress(0)
    setScreen('syncing')
  }

  useEffect(() => {
    if (screen !== 'syncing') return
    const timer = window.setInterval(() => {
      setSyncProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer)
          window.setTimeout(() => setScreen('feed'), 450)
          return 100
        }
        return Math.min(current + 4, 100)
      })
    }, 70)
    return () => window.clearInterval(timer)
  }, [screen])

  const recordCheck = (topic: string, correct: boolean) => {
    setTopicCorrectStreak((current) => {
      const nextCount = correct ? (current[topic] ?? 0) + 1 : 0
      setTopicStatus((status) => ({
        ...status,
        [topic]: !correct
          ? 'needsWork'
          : nextCount >= 2 || status[topic] === 'mastered'
            ? 'mastered'
            : 'learning',
      }))
      return { ...current, [topic]: nextCount }
    })
    if (!correct) setAssignmentSnoozed(false)
  }

  const assignmentReady =
    !assignmentOpened &&
    !assignmentSnoozed &&
    assignment.topics.every((topic) => {
      const status = topicStatus[topic]
      const streakCount = topicCorrectStreak[topic] ?? 0
      return status === 'mastered' || streakCount >= 2
    })

  const visiblePosts = useMemo(() => {
    const list = selectedClass === 'All'
      ? [...allPosts]
      : allPosts.filter((post) => post.classCode === selectedClass)

    const filtered = passiveMode
      ? list.filter((post) => !(post.modality === 'drill' && post.quiz?.type === 'fill'))
      : list

    const score = (post: Post) => (topicStatus[post.topic] === 'needsWork' ? 1 : 0)
    return filtered.sort((a, b) => score(b) - score(a))
  }, [selectedClass, topicStatus, allPosts, passiveMode])

  const visibleDues = useMemo(() => {
    const list = selectedClass === 'All'
      ? [...upcomingItems]
      : upcomingItems.filter((item) => item.classCode === selectedClass)
    return list.sort((a, b) => a.dueOffset - b.dueOffset)
  }, [selectedClass])

  const showAssignmentCard =
    assignmentReady &&
    (selectedClass === 'All' || selectedClass === assignment.classCode)

  const allPostsComplete = useMemo(() => {
    if (visiblePosts.length === 0) return false
    return visiblePosts.every((post) => (
      post.modality === 'drill' ? answeredIds.includes(post.id) : true
    ))
  }, [visiblePosts, answeredIds])

  const feedItems = useMemo(() => {
    const items: FeedItem[] = []

    visiblePosts.forEach((post) => items.push({ type: 'post', post }))
    if (allPostsComplete && visibleDues.length > 0) items.push({ type: 'due', items: visibleDues })
    if (showAssignmentCard) items.push({ type: 'assignment' })
    if (allPostsComplete) items.push({ type: 'complete' })
    return items
  }, [visibleDues, showAssignmentCard, visiblePosts, allPostsComplete])

  const visibleFeedItems = useMemo(() => {
    for (let i = 0; i < feedItems.length; i++) {
      const item = feedItems[i]
      if (
        item.type === 'post'
        && item.post.modality === 'drill'
        && !answeredIds.includes(item.post.id)
      ) {
        return feedItems.slice(0, i + 1)
      }
    }
    return feedItems
  }, [feedItems, answeredIds])

  useEffect(() => {
    if (selectedClass !== 'All' && !classesWithPosts.has(selectedClass)) {
      setSelectedClass('All')
      localStorage.setItem(LAST_FEED_CLASS_KEY, 'All')
    }
  }, [selectedClass, classesWithPosts])

  useEffect(() => {
    restoreFeedRef.current = true
    setCommentsOpen(false)
    setShowAllDues(false)
    localStorage.setItem(LAST_FEED_CLASS_KEY, selectedClass)
  }, [selectedClass])

  useEffect(() => {
    if (screen !== 'feed' || mainView !== 'feed') return
    restoreFeedRef.current = true
  }, [mainView, screen])

  useEffect(() => {
    if (screen !== 'feed' || mainView !== 'feed' || !restoreFeedRef.current) return
    if (visibleFeedItems.length === 0) return

    const savedKey = feedPositions[selectedClass]
    let targetIndex = 0
    if (savedKey) {
      const found = visibleFeedItems.findIndex((item, index) => (
        getFeedItemKey(item, index) === savedKey
      ))
      if (found >= 0) targetIndex = found
    }

    targetIndex = Math.min(targetIndex, visibleFeedItems.length - 1)

    const root = feedRef.current
    requestAnimationFrame(() => {
      const slides = root?.querySelectorAll<HTMLElement>('.feed-slide')
      slides?.[targetIndex]?.scrollIntoView({ behavior: 'auto', block: 'start' })
      setActiveIndex(targetIndex)
      restoreFeedRef.current = false
    })
  }, [screen, mainView, selectedClass, visibleFeedItems.length, feedPositions])

  useEffect(() => {
    if (screen !== 'feed' || mainView !== 'feed' || restoreFeedRef.current) return
    const item = visibleFeedItems[activeIndex]
    if (!item) return
    const key = getFeedItemKey(item, activeIndex)
    setFeedPositions((current) => (
      current[selectedClass] === key ? current : { ...current, [selectedClass]: key }
    ))
    localStorage.setItem(LAST_FEED_CLASS_KEY, selectedClass)
  }, [activeIndex, selectedClass, screen, mainView, visibleFeedItems])

  useEffect(() => {
    setCommentsOpen(false)
  }, [activeIndex])

  useEffect(() => {
    if (screen !== 'feed') return
    const root = feedRef.current
    if (!root) return

    const slides = Array.from(root.querySelectorAll<HTMLElement>('.feed-slide'))
    if (slides.length === 0) return

    const syncActiveFromScroll = () => {
      const rootRect = root.getBoundingClientRect()
      const midpoint = rootRect.top + rootRect.height / 2
      let bestIndex = 0
      let bestDistance = Number.POSITIVE_INFINITY
      slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect()
        const slideMid = rect.top + rect.height / 2
        const distance = Math.abs(slideMid - midpoint)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })
      setActiveIndex((current) => (current === bestIndex ? current : bestIndex))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = slides.indexOf(visible.target as HTMLElement)
        if (index >= 0) setActiveIndex((current) => (current === index ? current : index))
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    )

    slides.forEach((slide) => observer.observe(slide))
    root.addEventListener('scroll', syncActiveFromScroll, { passive: true })
    syncActiveFromScroll()
    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', syncActiveFromScroll)
    }
  }, [visibleFeedItems.length, selectedClass, screen])

  useEffect(() => {
    if (screen !== 'feed') return
    const root = feedRef.current
    if (!root) return
    const slides = root.querySelectorAll<HTMLElement>('.feed-slide')
    slides.forEach((slide, index) => {
      if (index === activeIndex) return
      slide.querySelectorAll('video').forEach((video) => {
        video.pause()
        video.muted = true
      })
    })
  }, [activeIndex, screen, visibleFeedItems.length])

  const scrollFeed = (direction: -1 | 1) => {
    const next = Math.min(Math.max(activeIndex + direction, 0), Math.max(visibleFeedItems.length - 1, 0))
    const slides = feedRef.current?.querySelectorAll<HTMLElement>('.feed-slide')
    slides?.[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveIndex(next)
  }

  if (screen === 'auth') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="wordmark">StudyQuest</div>
          <h1>{authMode === 'signup' ? 'Sign up' : 'Log in'}</h1>

          <form onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <label>
                Name
                <input required placeholder="Alex Morgan" />
              </label>
            )}
            <label>
              Email
              <input required type="email" placeholder="alex@cca.edu" />
            </label>
            <label>
              Password
              <input required type="password" placeholder="Password" minLength={8} />
            </label>
            <button className="primary-button" type="submit">
              {authMode === 'signup' ? 'Continue' : 'Log in'}
            </button>
          </form>

          <div className="divider"><span>or</span></div>
          <button className="google-button" type="button" onClick={() => {
            if (authMode === 'signup') setScreen('connect')
            else goToFeed()
          }}>
            <span className="google-g">G</span>
            Continue with Google
          </button>
          <p className="switch-auth">
            {authMode === 'signup' ? 'Have an account?' : 'Need an account?'}
            <button type="button" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>
              {authMode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
      </main>
    )
  }

  if (screen === 'connect') {
    return (
      <main className="onboarding-page">
        <div className="connect-card">
          <button className="back-button" onClick={() => setScreen('auth')}><ArrowLeft size={18} /> Back</button>
          <h1>Connect your classes</h1>
          <div className="provider-list">
            <button onClick={() => startSync('Google Classroom')}>
              <span className="provider-icon classroom">G</span>
              <strong>Google Classroom</strong>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => startSync('Canvas')}>
              <span className="provider-icon canvas">C</span>
              <strong>Canvas</strong>
              <ChevronRight size={18} />
            </button>
          </div>
          <button className="text-button" onClick={() => goToFeed('Google Classroom')}>Skip</button>
        </div>
      </main>
    )
  }

  if (screen === 'syncing') {
    return (
      <main className="sync-page">
        <div className="sync-card">
          <h1>{syncProgress === 100 ? 'Ready' : `Syncing ${provider}`}</h1>
          <div className="progress-track"><span style={{ width: `${syncProgress}%` }} /></div>
          <div className="sync-status">
            {classes.map((item, index) => {
              const ready = syncProgress >= (index + 1) * 25
              return (
                <div className={ready ? 'ready' : ''} key={item}>
                  <span>{ready ? <Check size={14} /> : index + 1}</span>
                  <p><strong>{item}</strong></p>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`app-shell ${commentsOpen && mainView === 'feed' ? 'comments-open' : ''}${mobileNavOpen ? ' nav-open' : ''}${passiveMode ? ' passive-mode' : ''}${mobileStudy ? ' is-mobile-study' : ''}`}>
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label="Open menu"
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar"
        hidden={mobileNavOpen || passiveMode}
        onClick={() => {
          setCommentsOpen(false)
          setMobileNavOpen(true)
        }}
      >
        <Menu size={22} strokeWidth={2.2} />
      </button>

      {mobileStudy && mainView === 'feed' && (
        <div className="study-mode-toggle" role="group" aria-label="Study mode">
          <button
            type="button"
            className={studyMode === 'active' ? 'active' : ''}
            aria-pressed={studyMode === 'active'}
            onClick={() => setStudyMode('active')}
          >
            <Video size={14} strokeWidth={2.2} />
            Active
          </button>
          <button
            type="button"
            className={studyMode === 'passive' ? 'active' : ''}
            aria-pressed={studyMode === 'passive'}
            onClick={() => {
              markSessionAudioUnlocked()
              unlockSpeechSynthesis()
              warmUpSpeechRecognition()
              setStudyMode('passive')
            }}
          >
            <Headphones size={14} strokeWidth={2.2} />
            Passive
          </button>
        </div>
      )}

      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside id="app-sidebar" className={`app-sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="StudyQuest">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="wordmark">StudyQuest</div>
            <button
              type="button"
              className="sidebar-close"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <X size={20} strokeWidth={2.2} />
            </button>
          </div>

          <nav className="sidebar-nav" aria-label="Main">
            <div className="nav-block">
              <button
                type="button"
                className={`nav-parent ${mainView === 'feed' && selectedClass === 'All' ? 'active' : ''}`}
                onClick={() => openFeedClass('All')}
              >
                <Home size={22} strokeWidth={mainView === 'feed' && selectedClass === 'All' ? 2.4 : 2} />
                <span>Feed</span>
              </button>

              <div className="nav-sub" role="group" aria-label="Classes">
                {classFilters.map(({ id, label, Icon }) => {
                  const enabled = classesWithPosts.has(id)
                  return (
                    <button
                      type="button"
                      className={mainView === 'feed' && selectedClass === id ? 'active' : ''}
                      key={id}
                      disabled={!enabled}
                      aria-disabled={!enabled}
                      onClick={() => openFeedClass(id)}
                    >
                      <Icon size={18} strokeWidth={mainView === 'feed' && selectedClass === id ? 2.4 : 2} />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              className={`nav-parent ${mainView === 'saved' ? 'active' : ''}`}
              onClick={() => openMainView('saved')}
            >
              <Bookmark size={22} strokeWidth={mainView === 'saved' ? 2.4 : 2} />
              <span>Saved</span>
            </button>

            <button
              type="button"
              className={`nav-parent ${mainView === 'upload' ? 'active' : ''}`}
              onClick={() => openMainView('upload')}
            >
              <Plus size={22} strokeWidth={mainView === 'upload' ? 2.4 : 2} />
              <span>Upload</span>
            </button>

            <button
              type="button"
              className={`nav-parent ${mainView === 'profile' ? 'active' : ''}`}
              onClick={() => openMainView('profile')}
            >
              <User size={22} strokeWidth={mainView === 'profile' ? 2.4 : 2} />
              <span>Profile</span>
            </button>
          </nav>
        </div>
      </aside>

      {mainView === 'feed' ? (
      <div className="feed-layout">
        <section className="feed-scroll" ref={feedRef} aria-label="Study feed">
          {visibleFeedItems.map((item, index) => (
            <div
              className="feed-slide"
              key={
                item.type === 'post'
                  ? item.post.id
                  : item.type === 'due'
                    ? 'due-board'
                    : item.type === 'complete'
                      ? 'feed-complete'
                      : `assignment-${index}`
              }
            >
              {item.type === 'due' ? (
                <div className="tiktok-row">
                  <article className="post-frame due">
                    <div className="due-panel">
                      <h2>Due soon on {providerLabel}</h2>
                      <ul className="due-list">
                        {(showAllDues
                          ? [...upcomingItems].sort((a, b) => a.dueOffset - b.dueOffset)
                          : item.items
                        ).map((due) => (
                          <li key={due.id}>
                            <a
                              href={due.urls[provider ?? 'Google Classroom']}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className="due-row-top">
                                <span className="due-row-meta">
                                  {due.classCode}
                                  <span className="due-row-type">{due.type}</span>
                                </span>
                                <span className="due-row-when">{due.due}</span>
                              </span>
                              <strong>{due.title}</strong>
                            </a>
                          </li>
                        ))}
                      </ul>
                      {selectedClass !== 'All'
                        && upcomingItems.some((due) => due.classCode !== selectedClass)
                        && (
                        <button
                          type="button"
                          className="due-more"
                          onClick={() => setShowAllDues((open) => !open)}
                        >
                          {showAllDues ? `Show ${selectedClass} only` : 'See other classes'}
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              ) : item.type === 'assignment' ? (
                <div className="tiktok-row">
                  <article className="post-frame assignment">
                    <div className="post-top-left">
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => setSelectedClass(assignment.classCode)}
                        aria-label={assignment.classCode}
                      >
                        <span className="action-icon class-avatar">
                          {(() => {
                            const Icon = classFilters.find((item) => item.id === assignment.classCode)?.Icon ?? BookOpen
                            return <Icon size={20} strokeWidth={2.2} />
                          })()}
                        </span>
                      </button>
                    </div>
                    <div className="assignment-content">
                      <h2>Ready for {assignment.title}</h2>
                      <p>You’ve covered the related systems concepts. Open it while it’s fresh.</p>
                      <div className="lesson-actions">
                        <button className="lesson-primary" onClick={() => setAssignmentOpened(true)}>
                          Open assignment
                        </button>
                        <button className="lesson-secondary" onClick={() => setAssignmentSnoozed(true)}>
                          Keep practicing
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              ) : item.type === 'complete' ? (
                <div className="tiktok-row">
                  <article className="post-frame complete">
                    <div className="complete-content">
                      <span className="complete-badge" aria-hidden="true">
                        <Check size={28} strokeWidth={2.5} />
                      </span>
                      <h2>
                        {selectedClass === 'All'
                          ? "You're all caught up"
                          : `${selectedClass} complete`}
                      </h2>
                      <p>Nice work finishing everything here.</p>
                      {selectedClass !== 'All' && (
                        <div className="lesson-actions">
                          <button
                            type="button"
                            className="lesson-primary"
                            onClick={() => openFeedClass('All')}
                          >
                            Back to feed
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              ) : (
                <PostCard
                  post={item.post}
                  sourceUrl={sourceUrl}
                  sourceProvider={providerLabel}
                  active={index === activeIndex}
                  passive={passiveMode}
                  commentsOpen={commentsOpen && index === activeIndex}
                  onCommentsOpenChange={setCommentsOpen}
                  onCheck={recordCheck}
                  onComplete={() => markComplete(item.post.id)}
                  onQuizAnswered={() => markAnswered(item.post.id)}
                  savedQuizAnswer={quizResponses[item.post.id] ?? null}
                  onSaveQuizAnswer={(response) => saveQuizResponse(item.post.id, response)}
                  onNext={() => scrollFeed(1)}
                  hasNext={index < visibleFeedItems.length - 1}
                  saved={savedIds.includes(item.post.id)}
                  onToggleSave={() => toggleSaved(item.post.id)}
                  showContinueHint={
                    item.post.modality === 'drill'
                    && !answeredIds.includes(item.post.id)
                    && index === visibleFeedItems.length - 1
                  }
                />
              )}
            </div>
          ))}

          {visibleFeedItems.length === 0 && (
            <div className="feed-slide">
              <div className="tiktok-row">
                <article className="post-frame assignment">
                  <div className="assignment-content">
                    <h2>No posts here</h2>
                    <p>Pick another class to keep studying.</p>
                  </div>
                </article>
              </div>
            </div>
          )}
        </section>

        {visibleFeedItems.length > 1 && (
          <div className="feed-arrows">
            <button
              type="button"
              aria-label="Previous post"
              disabled={activeIndex <= 0}
              onClick={() => scrollFeed(-1)}
            >
              <ChevronUp size={20} />
            </button>
            <button
              type="button"
              aria-label="Next post"
              disabled={activeIndex >= visibleFeedItems.length - 1}
              onClick={() => scrollFeed(1)}
            >
              <ChevronDown size={20} />
            </button>
          </div>
        )}
      </div>
      ) : mainView === 'saved' ? (
        <section className="panel-view" aria-label="Saved">
          <p className="mobile-page-title">Saved</p>
          <header className="panel-header">
            <h1>Saved</h1>
          </header>

          {savedPosts.length > 0 && (
            <div className="panel-tabs" role="tablist" aria-label="Filter saved">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'video', label: 'Videos' },
                  { id: 'drill', label: 'Quizzes' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={savedFilter === tab.id}
                  className={savedFilter === tab.id ? 'active' : ''}
                  onClick={() => setSavedFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {savedPosts.length === 0 ? (
            <div className="panel-empty">
              <p>Tap Save on any post to keep it here.</p>
              <button type="button" className="lesson-primary" onClick={() => openFeedClass('All')}>
                Back to feed
              </button>
            </div>
          ) : filteredSavedPosts.length === 0 ? (
            <div className="panel-empty">
              <p>No {savedFilter === 'video' ? 'videos' : 'quizzes'} saved yet.</p>
            </div>
          ) : (
            <ul className="media-grid">
              {filteredSavedPosts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    className="media-tile"
                    onClick={() => openFeedClass(post.classCode)}
                  >
                    <span className="media-thumb">
                      {post.modality === 'video' && post.video ? (
                        <video src={post.video} muted playsInline preload="metadata" />
                      ) : (
                        <span className="media-quiz-thumb">Quiz</span>
                      )}
                      <span className="media-badge">
                        {post.modality === 'video' ? 'Video' : 'Quiz'}
                      </span>
                    </span>
                    <span className="media-copy">
                      <span className="media-meta">{post.classCode}</span>
                      <strong>{post.title}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="media-unsave"
                    aria-label="Unsave"
                    onClick={() => toggleSaved(post.id)}
                  >
                    <Bookmark size={16} fill="currentColor" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : mainView === 'upload' ? (
        <section className="panel-view" aria-label="Upload">
          <p className="mobile-page-title">Upload</p>
          <header className="panel-header">
            <h1>Upload</h1>
          </header>
          <div className="panel-tabs upload-tabs" role="tablist" aria-label="Upload type">
            {(
              [
                { id: 'generate', label: 'Generate', Icon: FileText },
                { id: 'video', label: 'Video', Icon: Video },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={uploadMode === tab.id}
                className={uploadMode === tab.id ? 'active' : ''}
                onClick={() => switchUploadMode(tab.id)}
              >
                <tab.Icon size={15} strokeWidth={2.2} />
                {tab.label}
              </button>
            ))}
          </div>
          <form className="upload-form" onSubmit={submitUpload}>
            <input
              ref={uploadInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              className="upload-file-input"
              aria-label="Choose video"
              onChange={(event) => applyUploadFile(event.target.files?.[0])}
            />
            {uploadMode === 'video' ? (
              <div
                className={`upload-drop ${uploadPreview ? 'has-preview' : ''} ${uploadDragging ? 'dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setUploadDragging(true)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setUploadDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setUploadDragging(false)
                  applyUploadFile(event.dataTransfer.files?.[0])
                }}
              >
                {uploadPreview ? (
                  <>
                    <video src={uploadPreview} controls playsInline />
                    <button
                      type="button"
                      className="upload-replace"
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      Change video
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="upload-drop-trigger"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <span className="upload-pick">
                      <Video size={28} strokeWidth={2} />
                      <strong>Choose a 1 min or less video</strong>
                      <span>MP4, WebM, or MOV</span>
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`upload-drop upload-drop-material ${selectedGenerateSample ? 'has-file' : ''} ${uploadGenerating ? 'generating' : ''}`}
              >
                {uploadGenerating ? (
                  <div className="upload-pick">
                    <span className="upload-generating-spinner" aria-hidden="true" />
                    <strong>Generating your video…</strong>
                    <span>StudyQuest AI is turning your file into a short clip.</span>
                  </div>
                ) : selectedGenerateSample ? (
                  <>
                    <div className="upload-pick upload-file-picked">
                      <FileText size={32} strokeWidth={2} />
                      <strong>{selectedGenerateSample.materialLabel}</strong>
                      <span>
                        {selectedGenerateSample.materialType} · {selectedGenerateSample.classCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="upload-replace"
                      onClick={openUploadPicker}
                    >
                      Change file
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="upload-drop-trigger"
                    onClick={openUploadPicker}
                  >
                    <span className="upload-pick">
                      <FileText size={28} strokeWidth={2} />
                      <strong>Choose slides, PDFs, or notes</strong>
                      <span>StudyQuest AI turns them into a short video</span>
                    </span>
                  </button>
                )}
              </div>
            )}
            {uploadMode === 'video' && uploadFileName && (
              <p className="upload-filename">{uploadFileName}</p>
            )}
            {uploadError && <p className="upload-error">{uploadError}</p>}

            <label>
              Class
              <select
                value={uploadClass}
                disabled={uploadGenerating}
                onChange={(event) => setUploadClass(event.target.value)}
              >
                {classes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Who can watch
              <select
                value={uploadPrivacy}
                disabled={uploadGenerating}
                onChange={(event) => setUploadPrivacy(event.target.value as UploadPrivacy)}
              >
                <option value="classmates">Classmates</option>
                <option value="only-me">Only me</option>
              </select>
            </label>

            <div className="lesson-actions">
              <button className="lesson-primary" type="submit" disabled={!uploadReady}>
                {uploadMode === 'generate'
                  ? uploadGenerating
                    ? 'Generating…'
                    : 'Generate video'
                  : 'Post'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="panel-view" aria-label="Profile">
          <p className="mobile-page-title">Profile</p>
          <header className="panel-header profile-header">
            <img className="profile-avatar" src={PROFILE_PHOTO} alt={PROFILE_NAME} />
            <div className="profile-identity">
              <h1>{PROFILE_NAME}</h1>
              <p>{PROFILE_EMAIL}</p>
              <p className="profile-school">{PROFILE_SCHOOL}</p>
            </div>
          </header>

          <div className="profile-section">
            <div className="profile-section-head">
              <h2>Progress</h2>
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="lesson-secondary">
                {providerLabel}
              </a>
            </div>
            <p className="progress-lead">
              {overallProgress.total === 0
                ? 'No study posts yet.'
                : overallProgress.done === 0
                  ? `You haven’t started yet — ${overallProgress.total} posts ready.`
                  : overallProgress.done === overallProgress.total
                    ? 'You’re caught up on everything.'
                    : `You’ve finished ${overallProgress.done} of ${overallProgress.total} posts.`}
            </p>
            <div className="progress-bar" aria-hidden="true">
              <span style={{ width: `${overallProgress.percent}%` }} />
            </div>
            <ul className="progress-class-list">
              {classProgress.map((item) => {
                const enabled = item.total > 0
                return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-disabled={!enabled}
                    onClick={() => openFeedClass(item.id)}
                  >
                    <span className="progress-class-top">
                      <span className="progress-class-name">
                        <span className="class-avatar class-avatar-sm" aria-hidden="true">
                          <item.Icon size={16} strokeWidth={2.2} />
                        </span>
                        <strong>{item.label}</strong>
                      </span>
                      <span className={`progress-status ${item.done === item.total && item.total > 0 ? 'done' : ''}`}>
                        {item.status}
                      </span>
                    </span>
                    <span className="progress-bar slim" aria-hidden="true">
                      <span style={{ width: `${item.percent}%` }} />
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
          </div>

          <div className="profile-section">
            <div className="profile-section-head">
              <h2>Your uploads</h2>
              <button type="button" className="lesson-secondary" onClick={() => setMainView('upload')}>
                Upload
              </button>
            </div>
            {userPosts.length === 0 ? (
              <p className="profile-muted">Nothing uploaded yet. Post a study clip for your class.</p>
            ) : (
              <ul className="media-grid">
                {userPosts.map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      className="media-tile"
                      onClick={() => openFeedClass(post.classCode)}
                    >
                      <span className="media-thumb">
                        {post.video ? (
                          <video src={post.video} muted playsInline preload="metadata" />
                        ) : (
                          <span className="media-quiz-thumb">Video</span>
                        )}
                        <span className="media-badge">Video</span>
                      </span>
                      <span className="media-copy">
                        <span className="media-meta">
                          {post.classCode}
                          {post.privacy === 'only-me' ? ' · Only you' : ''}
                        </span>
                        <strong>{post.title}</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="profile-footer-actions">
            <button type="button" className="lesson-primary" onClick={logOut}>
              Log out
            </button>
          </div>
        </section>
      )}

      {uploadPickerOpen && createPortal(
        <div
          className="upload-picker-backdrop"
          onClick={() => setUploadPickerOpen(false)}
        >
          <div
            className="upload-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose material"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="upload-picker-header">
              <div>
                <strong>Choose material</strong>
                <p>Select a class PDF for StudyQuest AI to turn into a video.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setUploadPickerOpen(false)}>
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>

            <label className="upload-picker-search">
              <Search size={16} strokeWidth={2.2} aria-hidden="true" />
              <input
                type="search"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search materials"
                autoFocus
              />
            </label>

            <div className="upload-picker-filters" role="tablist" aria-label="Filter materials">
              {([
                { id: 'all', label: 'All' },
                { id: 'lecture', label: 'Lectures' },
                { id: 'reading', label: 'Readings' },
              ] as const).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={pickerFilter === filter.id}
                  className={pickerFilter === filter.id ? 'active' : ''}
                  onClick={() => setPickerFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <ul className="upload-picker-list" role="listbox" aria-label="Materials">
              {filteredGenerateSamples.length === 0 ? (
                <li className="upload-picker-empty">No materials match that search.</li>
              ) : (
                filteredGenerateSamples.map((sample) => {
                  const selected = pickerHighlightId === sample.id
                  return (
                    <li key={sample.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={selected ? 'active' : ''}
                        onClick={() => setPickerHighlightId(sample.id)}
                        onDoubleClick={() => {
                          setUploadError('')
                          setUploadSampleId(sample.id)
                          setUploadClass(sample.classCode)
                          setUploadPickerOpen(false)
                        }}
                      >
                        <span className="upload-picker-icon" aria-hidden="true">
                          <FileText size={18} strokeWidth={2} />
                        </span>
                        <span className="upload-picker-copy">
                          <strong>{sample.materialLabel}</strong>
                          <span>
                            {sample.materialType}
                            {' · '}
                            {sample.category === 'lecture' ? 'Lecture' : 'Reading'}
                            {' · '}
                            {sample.classCode}
                          </span>
                        </span>
                        <span className={`upload-picker-check${selected ? ' is-on' : ''}`} aria-hidden="true">
                          {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            <footer className="upload-picker-footer">
              <span className="upload-picker-count">
                {pickerHighlightId ? '1 selected' : `${filteredGenerateSamples.length} materials`}
              </span>
              <div className="upload-picker-actions">
                <button type="button" className="upload-picker-cancel" onClick={() => setUploadPickerOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="upload-picker-confirm"
                  disabled={!pickerHighlightId}
                  onClick={confirmGenerateSample}
                >
                  Use material
                </button>
              </div>
            </footer>
          </div>
        </div>,
        document.body,
      )}

      <a
        className="build-badge"
        href={`https://github.com/thedannyshin/studyquest/commit/${__COMMIT_SHA__}`}
        target="_blank"
        rel="noreferrer"
        title={`Build ${__COMMIT_COUNT__} · ${__COMMIT_SHA__}`}
      >
        {__COMMIT_COUNT__} · {__COMMIT_SHA__}
      </a>
    </main>
  )
}

function formatPlayerTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function PostCard({
  post,
  sourceUrl,
  sourceProvider,
  active,
  passive,
  commentsOpen,
  onCommentsOpenChange,
  onCheck,
  onComplete,
  onQuizAnswered,
  savedQuizAnswer,
  onSaveQuizAnswer,
  onNext,
  hasNext,
  saved,
  onToggleSave,
  showContinueHint,
}: {
  post: Post
  sourceUrl: string
  sourceProvider: string
  active: boolean
  passive: boolean
  commentsOpen: boolean
  onCommentsOpenChange: (open: boolean) => void
  onCheck: (topic: string, correct: boolean) => void
  onComplete: () => void
  onQuizAnswered: () => void
  savedQuizAnswer: string | null
  onSaveQuizAnswer: (response: string) => void
  onNext: () => void
  hasNext: boolean
  saved: boolean
  onToggleSave: () => void
  showContinueHint: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scrubbingRef = useRef(false)
  const quiz = post.quiz
  const [answer, setAnswer] = useState(() => savedQuizAnswer ?? '')
  const [submitted, setSubmitted] = useState(() => Boolean(savedQuizAnswer))
  const [completed, setCompleted] = useState(() => (
    Boolean(savedQuizAnswer && quiz && savedQuizAnswer.trim().toLowerCase() === quiz.answer.toLowerCase())
  ))
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(commentSeeds)
  const [playing, setPlaying] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const soundOnRef = useRef(false)
  const controlsTimerRef = useRef<number>()
  const touchControls = shouldDeferVideoAutoplay()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [quizInputActive, setQuizInputActive] = useState(false)
  const [autoNextArmed, setAutoNextArmed] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'speaking' | 'listening' | 'unsupported'>('idle')
  const recordedRef = useRef(Boolean(savedQuizAnswer))
  const activeRef = useRef(active)
  const onNextRef = useRef(onNext)
  const chooseOptionRef = useRef<(option: string) => void>(() => {})
  onNextRef.current = onNext
  activeRef.current = active

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#lesson-${post.id}`

  const displayAnswer = savedQuizAnswer ?? answer
  const displaySubmitted = Boolean(savedQuizAnswer) || submitted
  const displayCorrect = quiz
    ? displayAnswer.trim().toLowerCase() === quiz.answer.toLowerCase()
    : false
  const title = post.modality === 'drill' && quiz ? quiz.question : post.title
  const classMeta = classFilters.find((item) => item.id === post.classCode)
  const ClassIcon = classMeta?.Icon ?? BookOpen

  useEffect(() => {
    if (!savedQuizAnswer) return
    setAnswer(savedQuizAnswer)
    setSubmitted(true)
    recordedRef.current = true
    if (quiz) {
      setCompleted(savedQuizAnswer.trim().toLowerCase() === quiz.answer.toLowerCase())
    }
  }, [post.id, savedQuizAnswer, quiz?.answer])

  const hideControlsAfterDelay = () => {
    window.clearTimeout(controlsTimerRef.current)
    setControlsVisible(true)
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2500)
  }

  const showControls = () => {
    hideControlsAfterDelay()
  }

  useEffect(() => () => window.clearTimeout(controlsTimerRef.current), [])

  useEffect(() => {
    if (!playing) {
      window.clearTimeout(controlsTimerRef.current)
      setControlsVisible(true)
      return
    }
    hideControlsAfterDelay()
  }, [playing])

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    if (!active) {
      setCreditOpen(false)
      setClassOpen(false)
      setAutoNextArmed(false)
      setSoundOn(false)
      soundOnRef.current = false
      setPlaying(false)
      setControlsVisible(true)
      window.clearTimeout(controlsTimerRef.current)
      const video = videoRef.current
      if (video) {
        video.pause()
        video.muted = true
      }
    }
  }, [active])

  useEffect(() => {
    if (!creditOpen) return
    const timer = window.setTimeout(() => setCreditOpen(false), 2000)
    return () => window.clearTimeout(timer)
  }, [creditOpen])

  useEffect(() => {
    if (!classOpen) return
    const timer = window.setTimeout(() => setClassOpen(false), 2000)
    return () => window.clearTimeout(timer)
  }, [classOpen])

  useEffect(() => {
    if (!active || !completed || !autoNextArmed || post.modality !== 'video' || !hasNext) return
    const timer = window.setTimeout(() => {
      setAutoNextArmed(false)
      onNextRef.current()
    }, passive ? 900 : 3000)
    return () => window.clearTimeout(timer)
  }, [active, completed, autoNextArmed, hasNext, post.modality, post.id, passive])

  useEffect(() => {
    if (!passive || !active || post.modality !== 'drill' || displaySubmitted || !quiz) return
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([18, 40, 18])
    }
  }, [passive, active, post.modality, post.id, displaySubmitted, quiz])

  useEffect(() => {
    if (!passive || !active || post.modality !== 'drill' || !displaySubmitted || !hasNext) return
    const timer = window.setTimeout(() => onNextRef.current(), 2200)
    return () => window.clearTimeout(timer)
  }, [passive, active, post.modality, displaySubmitted, hasNext, post.id])

  useEffect(() => {
    if (!passive || post.modality !== 'drill' || !quiz || quiz.type !== 'multiple-choice') {
      setVoiceStatus('idle')
      return
    }
    if (!active || displaySubmitted || !quiz.options?.length) {
      setVoiceStatus('idle')
      return
    }

    let cancelled = false
    let stopListening: (() => void) | null = null
    let started = false
    const sessionAtStart = getVoiceSession()

    // Warm MP3s while the slide settles (same idea as video preload).
    prefetchQuizAudio(quiz.question, quiz.options)

    const run = async () => {
      if (!canSpeakQuiz() && !canListenForQuiz()) {
        setVoiceStatus('unsupported')
        return
      }

      // Wait until Passive (or video) unlocked audio — same gate as other media.
      if (!isAudioSessionUnlocked() && !isSessionAudioUnlocked()) {
        setVoiceStatus('idle')
        return
      }

      ensureQuizAudioReady()
      started = true
      setVoiceStatus('speaking')
      const played = await speakQuiz(quiz.question, quiz.options ?? [])
      if (cancelled || !activeRef.current || sessionAtStart !== getVoiceSession()) return

      if (!played) {
        setVoiceStatus('idle')
        return
      }

      if (!canListenForQuiz()) {
        setVoiceStatus('unsupported')
        return
      }

      setVoiceStatus('listening')
      stopListening = startListeningForOption(
        quiz.options ?? [],
        (option) => {
          if (cancelled || !activeRef.current) return
          chooseOptionRef.current(option)
        },
        (status) => {
          if (cancelled) return
          if (status === 'listening') setVoiceStatus('listening')
          if (status === 'error') setVoiceStatus('unsupported')
        },
      )
    }

    // Debounce so scroll settling / Strict Mode remounts don't cancel mid-speak.
    const startTimer = window.setTimeout(() => {
      if (!cancelled) void run()
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      stopListening?.()
      // Only the card that started playback may stop the shared audio element.
      if (started) stopSpeaking()
      setVoiceStatus((current) => (current === 'listening' || current === 'speaking' ? 'idle' : current))
    }
  }, [passive, active, post.modality, post.id, displaySubmitted, quiz])

  const replayQuizSpeech = () => {
    if (!quiz?.options?.length || displaySubmitted) return
    setVoiceStatus('speaking')
    // Speak inside this tap — required for iOS Safari.
    void speakQuizFromGesture(quiz.question, quiz.options).then((session) => {
      if (!activeRef.current || displaySubmitted || session !== getVoiceSession()) return
      if (!canListenForQuiz()) {
        setVoiceStatus('unsupported')
        return
      }
      setVoiceStatus('listening')
    }).catch(() => {
      setVoiceStatus('unsupported')
    })
  }

  useEffect(() => {
    if (!passive || !active || !displaySubmitted || !quiz || quiz.type !== 'multiple-choice') return
    const line = displayCorrect
      ? 'Correct.'
      : `Incorrect. The answer is ${quiz.answer}.`
    const timer = window.setTimeout(() => {
      void speakText(line)
    }, 200)
    return () => {
      window.clearTimeout(timer)
      stopSpeaking()
    }
  }, [passive, active, displaySubmitted, displayCorrect, quiz, post.id])

  useEffect(() => {
    if (post.modality !== 'video') return
    const video = videoRef.current
    if (!video) return

    let cancelled = false

    const stop = () => {
      video.pause()
      video.muted = true
      setPlaying(false)
    }

    if (!active || completed) {
      stop()
      return () => {
        cancelled = true
        stop()
      }
    }

    const onPlay = () => {
      if (cancelled || !activeRef.current) {
        stop()
        return
      }
      setPlaying(true)
      hideControlsAfterDelay()
    }
    const onPause = () => {
      setPlaying(false)
      window.clearTimeout(controlsTimerRef.current)
      setControlsVisible(true)
    }
    const onTimeUpdate = () => {
      if (scrubbingRef.current || !video.duration) return
      setDuration(video.duration)
      setProgress(video.currentTime / video.duration)
    }
    const onLoaded = () => {
      if (!video.duration) return
      setDuration(video.duration)
      setProgress(video.currentTime / video.duration)
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoaded)
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    if (passive || !touchControls) {
      primeVideoForSound(video)
      soundOnRef.current = true
      setSoundOn(true)
    } else {
      video.muted = !soundOnRef.current
    }

    void video.play().then(() => {
      if (cancelled || !activeRef.current) {
        stop()
        return
      }
      if (passive && video.muted) {
        primeVideoForSound(video)
        soundOnRef.current = true
        setSoundOn(true)
      }
      if (!video.paused) hideControlsAfterDelay()
    }).catch(() => {
      if (!passive) return
      // Autoplay with sound blocked until the next tap.
      setPlaying(false)
    })

    return () => {
      cancelled = true
      stop()
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [active, post.modality, post.video, completed, touchControls, passive])

  const unlockSound = () => {
    const video = videoRef.current
    if (!video || !activeRef.current) return

    primeVideoForSound(video)
    soundOnRef.current = true
    setSoundOn(true)

    if (video.paused) {
      void video.play().then(() => {
        if (!activeRef.current) {
          video.pause()
          video.muted = true
        }
      }).catch(() => {})
      return
    }

    const time = video.currentTime
    video.pause()
    video.currentTime = time
    void video.play().then(() => {
      if (!activeRef.current) {
        video.pause()
        video.muted = true
      }
    }).catch(() => {})
  }

  const handleVideoControl = () => {
    const video = videoRef.current
    if (!video || !activeRef.current) return

    if (passive) {
      if (video.paused) {
        unlockSound()
        return
      }
      video.pause()
      return
    }

    if (playing && !controlsVisible) {
      showControls()
      return
    }

    if (video.paused) {
      void video.play().then(() => {
        if (!activeRef.current) {
          video.pause()
          video.muted = true
        }
      }).catch(() => {})
      return
    }

    if (!soundOnRef.current) {
      unlockSound()
      showControls()
      return
    }

    video.pause()
  }

  const seekToRatio = (ratio: number) => {
    const video = videoRef.current
    if (!video || !video.duration) return
    const next = Math.min(Math.max(ratio, 0), 1)
    video.currentTime = next * video.duration
    setProgress(next)
  }

  const ratioFromEvent = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return (event.clientX - rect.left) / rect.width
  }

  const finishVideo = () => {
    if (recordedRef.current) return
    recordedRef.current = true
    setCompleted(true)
    setAutoNextArmed(true)
    onCheck(post.topic, true)
    onComplete()
  }

  const markResult = (isCorrect: boolean) => {
    if (recordedRef.current) return
    recordedRef.current = true
    onCheck(post.topic, isCorrect)
    onQuizAnswered()
  }

  const submitQuiz = () => {
    if (!quiz || displaySubmitted) return
    const response = answer.trim()
    const isCorrect = response.toLowerCase() === quiz.answer.toLowerCase()
    setSubmitted(true)
    onSaveQuizAnswer(response)
    markResult(isCorrect)
    if (isCorrect) setCompleted(true)
  }

  const chooseOption = (option: string) => {
    if (displaySubmitted || !quiz) return
    const isCorrect = option === quiz.answer
    setAnswer(option)
    setSubmitted(true)
    onSaveQuizAnswer(option)
    markResult(isCorrect)
    if (isCorrect) setCompleted(true)
  }
  chooseOptionRef.current = chooseOption

  const addComment = (event: FormEvent) => {
    event.preventDefault()
    const text = comment.trim()
    if (!text) return
    setComments((current) => [
      ...current,
      {
        name: 'Alex Morgan',
        text,
        time: 'now',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
      },
    ])
    setComment('')
  }

  const showCenterControl = !playing || controlsVisible
  const elapsedLabel = formatPlayerTime(duration * progress)
  const remainingLabel = `-${formatPlayerTime(Math.max(duration * (1 - progress), 0))}`

  const renderQuiz = () => {
    if (!quiz) return null
    const isMultiple = quiz.type === 'multiple-choice'
    return (
      <div className="inline-quiz">
        {isMultiple ? (
          <div className="quiz-options">
            {quiz.options?.map((option, index) => {
              const isCorrectOption = option === quiz.answer
              const isChosen = displayAnswer === option
              const isIrrelevant = displaySubmitted && !isCorrectOption && !isChosen
              return (
                <button
                  key={option}
                  disabled={displaySubmitted}
                  className={[
                    isChosen ? 'selected' : '',
                    displaySubmitted && isCorrectOption ? 'correct' : '',
                    displaySubmitted && isChosen && !displayCorrect ? 'wrong' : '',
                    isIrrelevant ? 'dim' : '',
                  ].join(' ')}
                  onClick={() => chooseOption(option)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>{option}
                  {displaySubmitted && isCorrectOption && <Check size={17} />}
                  {displaySubmitted && isChosen && !displayCorrect && <X size={17} />}
                </button>
              )
            })}
          </div>
        ) : passive ? null : (
          <>
            <div className={`fill-field ${displaySubmitted ? (displayCorrect ? 'correct' : 'wrong') : ''}`}>
              <input
                className="fill-answer"
                placeholder="Type your answer"
                value={displayAnswer}
                disabled={displaySubmitted}
                onChange={(event) => setAnswer(event.target.value)}
                onFocus={() => {
                  if (touchControls) setQuizInputActive(true)
                }}
                onBlur={() => setQuizInputActive(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && answer.trim()) submitQuiz()
                }}
              />
              {!displaySubmitted && (
                <button
                  className="fill-send"
                  type="button"
                  disabled={!answer.trim()}
                  onClick={submitQuiz}
                  aria-label="Submit answer"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
            {displaySubmitted && (
              <div className={`quiz-result ${displayCorrect ? 'success' : 'retry'}`}>
                <strong>
                  {displayCorrect ? 'Correct' : `Incorrect, the answer is: ${quiz.answer}`}
                </strong>
              </div>
            )}
          </>
        )}
        {displaySubmitted && isMultiple && (
          <div className={`quiz-result ${displayCorrect ? 'success' : 'retry'}`}>
            <strong>
              {displayCorrect ? 'Correct' : `Incorrect, the answer is: ${quiz.answer}`}
            </strong>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="tiktok-row">
        <article className={`post-frame ${post.modality}${passive ? ' is-passive' : ''}`} id={`lesson-${post.id}`}>
          {post.privacy === 'only-me' && (
            <span className="post-privacy">Only you</span>
          )}

          {!passive && (
            <div className={`post-credit ${creditOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="post-credit-btn"
                aria-label="Post info"
                aria-expanded={creditOpen}
                onClick={() => {
                  setClassOpen(false)
                  setCreditOpen((open) => !open)
                }}
              >
                <Info size={18} strokeWidth={2.2} />
              </button>
              {creditOpen && (
                <div className="post-credit-tip">
                  {post.modality === 'video' && (
                    <p>{getVideoAttribution(post.postedBy)}</p>
                  )}
                  <p className="post-credit-meta">
                    Source:{' '}
                    {post.generatedFrom ? (
                      post.generatedFrom
                    ) : !post.postedBy || post.postedBy === 'StudyQuest AI' ? (
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        {sourceProvider}
                      </a>
                    ) : post.postedBy === PROFILE_NAME ? (
                      'Your upload'
                    ) : (
                      post.postedBy
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {post.modality === 'video' && post.video ? (
            <div className={`lesson-media${passive ? ' is-passive-media' : ''}`}>
              <video
                ref={videoRef}
                src={post.video}
                playsInline
                muted={!soundOn}
                loop={false}
                preload="auto"
                onEnded={finishVideo}
                onClick={passive ? undefined : handleVideoControl}
              />
              {passive ? (
                <div className="passive-player">
                  <div className="passive-meta">
                    <p className="passive-kicker">{post.classCode}</p>
                    <h2>{post.title}</h2>
                    <p className="passive-hint">{playing ? 'Now playing' : 'Tap play to listen'}</p>
                  </div>
                  <div
                    className="passive-scrubber"
                    role="slider"
                    aria-label="Audio progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    tabIndex={0}
                    onPointerDown={(event) => {
                      scrubbingRef.current = true
                      event.currentTarget.setPointerCapture(event.pointerId)
                      seekToRatio(ratioFromEvent(event))
                    }}
                    onPointerMove={(event) => {
                      if (!scrubbingRef.current) return
                      seekToRatio(ratioFromEvent(event))
                    }}
                    onPointerUp={() => {
                      scrubbingRef.current = false
                    }}
                    onPointerCancel={() => {
                      scrubbingRef.current = false
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight') seekToRatio(progress + 0.05)
                      if (event.key === 'ArrowLeft') seekToRatio(progress - 0.05)
                    }}
                  >
                    <span className="passive-scrubber-track">
                      <span className="passive-scrubber-fill" style={{ width: `${progress * 100}%` }} />
                    </span>
                    <span className="passive-times">
                      <span>{elapsedLabel}</span>
                      <span>{remainingLabel}</span>
                    </span>
                  </div>
                  <div className="passive-controls">
                    <button
                      type="button"
                      className="passive-play-btn"
                      onClick={handleVideoControl}
                      aria-label={playing ? 'Pause' : 'Play'}
                    >
                      {playing ? (
                        <Pause size={30} fill="currentColor" />
                      ) : (
                        <Play size={30} fill="currentColor" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`video-play-toggle${showCenterControl ? ' is-shown' : ''}${playing && !soundOn ? ' is-muted' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleVideoControl()
                    }}
                    aria-label={playing && !soundOn ? 'Unmute' : playing ? 'Pause' : 'Play'}
                  >
                    {playing && !soundOn ? (
                      <VolumeX size={28} strokeWidth={2.2} />
                    ) : playing ? (
                      <Pause size={28} fill="currentColor" />
                    ) : (
                      <Play size={28} fill="currentColor" />
                    )}
                  </button>
                  <div
                    className="video-timeline"
                    role="slider"
                    aria-label="Video progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    tabIndex={0}
                    onPointerDown={(event) => {
                      scrubbingRef.current = true
                      event.currentTarget.setPointerCapture(event.pointerId)
                      seekToRatio(ratioFromEvent(event))
                    }}
                    onPointerMove={(event) => {
                      if (!scrubbingRef.current) return
                      seekToRatio(ratioFromEvent(event))
                    }}
                    onPointerUp={() => {
                      scrubbingRef.current = false
                    }}
                    onPointerCancel={() => {
                      scrubbingRef.current = false
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight') seekToRatio(progress + 0.05)
                      if (event.key === 'ArrowLeft') seekToRatio(progress - 0.05)
                    }}
                  >
                    <span className="video-timeline-track">
                      <span className="video-timeline-fill" style={{ width: `${progress * 100}%` }} />
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={`quiz-stack${passive ? ' is-passive-quiz' : ''}${showContinueHint ? ' has-continue-hint' : ''}`}>
              {passive && (
                <div className="passive-voice-bar">
                  <p className="passive-voice-status" role="status">
                    {displaySubmitted
                      ? (displayCorrect ? 'Correct' : 'Incorrect')
                      : voiceStatus === 'speaking'
                        ? 'Playing quiz audio…'
                        : voiceStatus === 'listening'
                          ? 'Listening… say A, B, C, or D'
                          : voiceStatus === 'unsupported'
                            ? 'Voice unavailable — tap an answer'
                            : 'Starting…'}
                  </p>
                  {!displaySubmitted && canSpeakQuiz() && (
                    <button
                      type="button"
                      className="passive-hear-btn"
                      onClick={replayQuizSpeech}
                    >
                      Hear question
                    </button>
                  )}
                </div>
              )}
              <div className="quiz-header">
                <h2>{title}</h2>
              </div>
              {renderQuiz()}
            </div>
          )}

          {!passive && (
            <aside className={`action-rail${quizInputActive ? ' is-hidden' : ''}`} aria-label="Post actions">
              <div className={`action-class ${classOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="action-btn"
                  aria-label="Class"
                  aria-expanded={classOpen}
                  onClick={() => {
                    setCreditOpen(false)
                    setClassOpen((open) => !open)
                  }}
                >
                  <span className="action-icon class-avatar">
                    <ClassIcon size={20} strokeWidth={2.2} />
                  </span>
                </button>
                {classOpen && (
                  <div className="action-class-tip">
                    <p>{classMeta?.label ?? post.classCode}</p>
                  </div>
                )}
              </div>

              {post.modality === 'video' && (
                <button
                  type="button"
                  className={`action-btn ${commentsOpen ? 'active' : ''}`}
                  onClick={() => onCommentsOpenChange(!commentsOpen)}
                  aria-label="Comments"
                >
                  <span className="action-icon comment-icon"><MessageCircle size={20} /></span>
                </button>
              )}

              <button
                type="button"
                className={`action-btn ${saved ? 'active' : ''}`}
                onClick={onToggleSave}
                aria-label={saved ? 'Unsave' : 'Save'}
              >
                <span className="action-icon">
                  <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
                </span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => {
                  setShareCopied(false)
                  setShareOpen(true)
                }}
                aria-label="Share"
              >
                <span className="action-icon"><Link size={20} /></span>
              </button>
            </aside>
          )}

          {showContinueHint && (
            <p className={`post-advance-hint${passive ? ' is-passive' : ''}`} role="status">
              Answer this quiz to continue.
            </p>
          )}
        </article>
      </div>

      {shareOpen && (
        <div
          className="share-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShareOpen(false)
          }}
        >
          <div className="share-modal" role="dialog" aria-modal="true" aria-label="Share link">
            <header>
              <strong>Share</strong>
              <button type="button" onClick={() => setShareOpen(false)} aria-label="Close share">
                <X size={18} />
              </button>
            </header>
            <p>Copy this link to share the post.</p>
            <div className="share-link-row">
              <input readOnly value={shareUrl} aria-label="Share link" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    setShareCopied(true)
                  } catch {
                    setShareCopied(false)
                  }
                }}
              >
                {shareCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {active && commentsOpen && post.modality === 'video' && createPortal(
        <>
          <button
            type="button"
            className="comments-backdrop"
            aria-label="Close comments"
            onClick={() => onCommentsOpenChange(false)}
          />
          <aside className="comments-sidebar" aria-label="Comments">
            <header>
              <strong>Comments {comments.length}</strong>
              <button type="button" onClick={() => onCommentsOpenChange(false)} aria-label="Close comments">
                <X size={18} />
              </button>
            </header>
            <div className="inline-comments-list">
              {comments.map((item, index) => (
                <article className="inline-comment" key={`${item.name}-${index}`}>
                  <img className="comment-avatar" src={item.avatar} alt="" />
                  <p><strong>{item.name}</strong> {item.text}</p>
                </article>
              ))}
            </div>
            <form className="inline-comment-form" onSubmit={addComment}>
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment"
                aria-label="Add a comment"
              />
              <button type="submit" disabled={!comment.trim()}>Post</button>
            </form>
          </aside>
        </>,
        document.body,
      )}
    </>
  )
}

export default App
