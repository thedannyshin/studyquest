import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  primeVideoForSound,
  shouldDeferVideoAutoplay,
} from './videoAudio'
import {
  ArrowLeft,
  Atom,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dna,
  Home,
  Info,
  Landmark,
  Link,
  Menu,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Send,
  FileText,
  User,
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

type GenerateSample = {
  id: string
  title: string
  materialLabel: string
  materialType: string
  classCode: string
  video: string
}

const generateSamples: GenerateSample[] = [
  {
    id: 'bio-cell-notes',
    title: 'Cell structure overview',
    materialLabel: 'Cell structure slides',
    materialType: 'PDF',
    classCode: 'BIO 102',
    video: '/biology-water.mp4',
  },
  {
    id: 'chem-bonding-notes',
    title: 'Ionic vs covalent bonds',
    materialLabel: 'Bonding lecture notes',
    materialType: 'Slides',
    classCode: 'CHEM 101',
    video: '/chemistry-bonds.mp4',
  },
  {
    id: 'hist-silk-road-notes',
    title: 'The Silk Road in 60 seconds',
    materialLabel: 'Trade networks packet',
    materialType: 'PDF',
    classCode: 'HIST 204',
    video: '/biology-water.mp4',
  },
]

const classes = ['BIO 102', 'CHEM 101', 'HIST 204']

const classFilters = [
  { id: 'BIO 102', label: 'BIO 102', Icon: Dna },
  { id: 'CHEM 101', label: 'CHEM 101', Icon: Atom },
  { id: 'HIST 204', label: 'HIST 204', Icon: Landmark },
] as const

const posts: Post[] = [
  {
    id: 1,
    classCode: 'BIO 102',
    title: 'Why is water a polar molecule?',
    modality: 'video',
    topic: 'polarity',
    sourceLabel: 'Water properties',
    video: '/biology-water.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 4,
    classCode: 'BIO 102',
    title: 'What makes water polar?',
    modality: 'drill',
    topic: 'polarity',
    sourceLabel: 'Water properties',
    quiz: {
      type: 'multiple-choice',
      question: 'What makes water polar?',
      options: [
        'Equal electron sharing',
        'Unequal electron sharing',
        'Equal proton counts',
        'A net positive charge',
      ],
      answer: 'Unequal electron sharing',
    },
  },
  {
    id: 5,
    classCode: 'BIO 102',
    title: 'Water is polar because electrons are shared _____.',
    modality: 'drill',
    topic: 'polarity',
    sourceLabel: 'Water properties',
    quiz: {
      type: 'fill',
      question: 'Water is polar because electrons are shared _____.',
      answer: 'unequally',
    },
  },
  {
    id: 2,
    classCode: 'CHEM 101',
    title: 'Ionic vs. covalent bonds',
    modality: 'video',
    topic: 'bonds',
    sourceLabel: 'Bonding unit',
    video: '/chemistry-bonds.mp4',
    postedBy: 'StudyQuest AI',
  },
  {
    id: 6,
    classCode: 'CHEM 101',
    title: 'In a covalent bond, what do atoms do with electrons?',
    modality: 'drill',
    topic: 'bonds',
    sourceLabel: 'Bonding unit',
    quiz: {
      type: 'multiple-choice',
      question: 'In a covalent bond, what do atoms do with electrons?',
      options: [
        'Transfer them completely',
        'Share them',
        'Destroy them',
        'Ignore them',
      ],
      answer: 'Share them',
    },
  },
  {
    id: 3,
    classCode: 'HIST 204',
    title: 'The Silk Road in 60 seconds',
    modality: 'video',
    topic: 'silk-road',
    sourceLabel: 'Trade networks',
    video: '/biology-water.mp4',
    postedBy: 'StudyQuest AI',
  },
]

const assignment = {
  id: 'bio-water-quiz',
  classCode: 'BIO 102',
  title: 'Water properties quiz',
  topics: ['polarity'],
}

const upcomingItems = [
  {
    id: 'up-1',
    type: 'Quiz',
    title: 'Water properties quiz',
    classCode: 'BIO 102',
    due: 'Due Fri',
    dueOffset: 3,
    urls: {
      'Google Classroom': 'https://classroom.google.com/c/NjM4/a/water-quiz/details',
      Canvas: 'https://canvas.instructure.com/courses/bio102/assignments/water-quiz',
    },
  },
  {
    id: 'up-1b',
    type: 'Lab',
    title: 'Osmosis lab report',
    classCode: 'BIO 102',
    due: 'Due Thu',
    dueOffset: 2,
    urls: {
      'Google Classroom': 'https://classroom.google.com/c/NjM4/a/osmosis-lab/details',
      Canvas: 'https://canvas.instructure.com/courses/bio102/assignments/osmosis-lab',
    },
  },
  {
    id: 'up-2',
    type: 'Assignment',
    title: 'Bonding worksheet',
    classCode: 'CHEM 101',
    due: 'Due Mon',
    dueOffset: 6,
    urls: {
      'Google Classroom': 'https://classroom.google.com/c/NjM5/a/bonding-worksheet/details',
      Canvas: 'https://canvas.instructure.com/courses/chem101/assignments/bonding-worksheet',
    },
  },
  {
    id: 'up-3',
    type: 'Test',
    title: 'Trade networks exam',
    classCode: 'HIST 204',
    due: 'Due Wed',
    dueOffset: 1,
    urls: {
      'Google Classroom': 'https://classroom.google.com/c/NjQw/a/trade-networks-exam/details',
      Canvas: 'https://canvas.instructure.com/courses/hist204/assignments/trade-networks-exam',
    },
  },
] as const

const commentSeeds = [
  {
    name: 'Jordan S.',
    text: 'The example at the end made this click for me.',
    time: '12m',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Riley K.',
    text: 'Can someone explain the second part again?',
    time: '8m',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'Taylor M.',
    text: 'I got the quiz right on my second try.',
    time: '3m',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
]

const SESSION_KEY = 'study-quest-session'
const SAVED_KEY = 'study-quest-saved'
const PROGRESS_KEY = 'study-quest-progress'
const ANSWERED_KEY = 'study-quest-answered'
const QUIZ_RESPONSES_KEY = 'study-quest-quiz-responses'

type QuizResponses = Record<number, string>
const PROFILE_PHOTO = 'https://randomuser.me/api/portraits/women/68.jpg'
const PROFILE_NAME = 'Alex Morgan'
const PROFILE_EMAIL = 'alex@northbridge.edu'
const PROFILE_SCHOOL = 'Northbridge University'

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

function mergeAnsweredIds(ids: number[], responses: QuizResponses) {
  const fromResponses = Object.keys(responses)
    .map((key) => Number(key))
    .filter((id) => Number.isFinite(id))
  return [...new Set([...ids, ...fromResponses])]
}

function App() {
  const initialSession = useMemo(() => readSession(), [])
  const [screen, setScreen] = useState<Screen>(() => initialSession.screen)
  const [mainView, setMainView] = useState<MainView>('feed')
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [provider, setProvider] = useState<Provider | null>(() => initialSession.provider)
  const [syncProgress, setSyncProgress] = useState(0)
  const [selectedClass, setSelectedClass] = useState('All')
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
  const [uploadMode, setUploadMode] = useState<UploadMode>('video')
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadSampleId, setUploadSampleId] = useState<string | null>(null)
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false)
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadGenerating, setUploadGenerating] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showAllDues, setShowAllDues] = useState(false)
  const feedRef = useRef<HTMLElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

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
      if (total === 0) status = 'Nothing here yet'
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

  const selectGenerateSample = (sample: GenerateSample) => {
    setUploadError('')
    setUploadSampleId(sample.id)
    setUploadClass(sample.classCode)
    setUploadPickerOpen(false)
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
    setSelectedClass(classCode)
    setMainView('feed')
    setCommentsOpen(false)
    setMobileNavOpen(false)
  }

  const openMainView = (view: MainView) => {
    setMainView(view)
    setCommentsOpen(false)
    setMobileNavOpen(false)
  }

  const logOut = () => {
    writeSession(false, null)
    setProvider(null)
    setMainView('feed')
    setScreen('auth')
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

    const score = (post: Post) => (topicStatus[post.topic] === 'needsWork' ? 1 : 0)
    return list.sort((a, b) => score(b) - score(a))
  }, [selectedClass, topicStatus, allPosts])

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
    const items: Array<
      | { type: 'due'; items: (typeof upcomingItems)[number][] }
      | { type: 'assignment' }
      | { type: 'post'; post: Post }
      | { type: 'complete' }
    > = []

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
    feedRef.current?.scrollTo({ top: 0 })
    setActiveIndex(0)
    setCommentsOpen(false)
    setShowAllDues(false)
  }, [selectedClass])

  useEffect(() => {
    setCommentsOpen(false)
  }, [activeIndex])

  useEffect(() => {
    if (screen !== 'feed') return
    const root = feedRef.current
    if (!root) return

    const slides = Array.from(root.querySelectorAll<HTMLElement>('.feed-slide'))
    if (slides.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = slides.indexOf(visible.target as HTMLElement)
        if (index >= 0) setActiveIndex(index)
      },
      { root, threshold: [0.55, 0.75] },
    )

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [visibleFeedItems.length, selectedClass, screen])

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
              <input required type="email" placeholder="alex@northbridge.edu" />
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
    <main className={`app-shell ${commentsOpen && mainView === 'feed' ? 'comments-open' : ''}${mobileNavOpen ? ' nav-open' : ''}`}>
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label="Open menu"
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar"
        hidden={mobileNavOpen}
        onClick={() => {
          setCommentsOpen(false)
          setMobileNavOpen(true)
        }}
      >
        <Menu size={22} strokeWidth={2.2} />
      </button>

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
                {classFilters.map(({ id, label, Icon }) => (
                  <button
                    type="button"
                    className={mainView === 'feed' && selectedClass === id ? 'active' : ''}
                    key={id}
                    onClick={() => openFeedClass(id)}
                  >
                    <Icon size={18} strokeWidth={mainView === 'feed' && selectedClass === id ? 2.4 : 2} />
                    <span>{label}</span>
                  </button>
                ))}
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
                      <p>You have the polarity checks. Open it while it is fresh.</p>
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
                { id: 'video', label: 'Video', Icon: Video },
                { id: 'generate', label: 'Generate', Icon: FileText },
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
                      onClick={() => setUploadPickerOpen(true)}
                    >
                      Change file
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="upload-drop-trigger"
                    onClick={() => setUploadPickerOpen(true)}
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
              {classProgress.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => openFeedClass(item.id)}>
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
              ))}
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
            aria-label="Choose materials"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>Choose materials</strong>
              <button type="button" aria-label="Close" onClick={() => setUploadPickerOpen(false)}>
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <p>Pick what you want StudyQuest AI to turn into a video.</p>
            <ul className="upload-picker-list">
              {generateSamples.map((sample) => (
                <li key={sample.id}>
                  <button
                    type="button"
                    className={uploadSampleId === sample.id ? 'active' : ''}
                    onClick={() => selectGenerateSample(sample)}
                  >
                    <span className="upload-picker-icon" aria-hidden="true">
                      <FileText size={20} strokeWidth={2} />
                    </span>
                    <span className="upload-picker-copy">
                      <strong>{sample.materialLabel}</strong>
                      <span>{sample.materialType} · {sample.classCode}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </main>
  )
}

function PostCard({
  post,
  sourceUrl,
  sourceProvider,
  active,
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
  const soundOnRef = useRef(false)
  const controlsTimerRef = useRef<number>()
  const touchControls = shouldDeferVideoAutoplay()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [autoNextArmed, setAutoNextArmed] = useState(false)
  const recordedRef = useRef(Boolean(savedQuizAnswer))
  const activeRef = useRef(active)
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
  activeRef.current = active

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#lesson-${post.id}`

  const correct = quiz
    ? answer.trim().toLowerCase() === quiz.answer.toLowerCase()
    : false
  const title = post.modality === 'drill' && quiz ? quiz.question : post.title
  const classMeta = classFilters.find((item) => item.id === post.classCode)
  const ClassIcon = classMeta?.Icon ?? BookOpen

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
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [active, completed, autoNextArmed, hasNext, post.modality, post.id])

  useEffect(() => {
    if (post.modality !== 'video' || completed) return
    const video = videoRef.current
    if (!video) return

    if (!active) {
      video.pause()
      video.muted = true
      return
    }

    const onPlay = () => {
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
      setProgress(video.currentTime / video.duration)
    }
    const onLoaded = () => {
      if (!video.duration) return
      setProgress(video.currentTime / video.duration)
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoaded)
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    if (touchControls) {
      video.muted = !soundOnRef.current
    } else {
      primeVideoForSound(video)
      soundOnRef.current = true
      setSoundOn(true)
    }
    void video.play().then(() => {
      if (!activeRef.current) {
        video.pause()
        video.muted = true
        return
      }
      if (!video.paused) hideControlsAfterDelay()
    }).catch(() => {})

    return () => {
      video.pause()
      video.muted = true
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [active, post.modality, post.video, completed, touchControls])

  useEffect(() => {
    if (post.modality !== 'video' || active) return
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.muted = true
  }, [active, post.modality])

  const unlockSound = () => {
    const video = videoRef.current
    if (!video) return

    primeVideoForSound(video)
    soundOnRef.current = true
    setSoundOn(true)

    if (video.paused) {
      void video.play().catch(() => {})
      return
    }

    const time = video.currentTime
    video.pause()
    video.currentTime = time
    void video.play().catch(() => {})
  }

  const handleVideoControl = () => {
    const video = videoRef.current
    if (!video) return

    if (playing && !controlsVisible) {
      showControls()
      return
    }

    if (video.paused) {
      void video.play().catch(() => {})
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
    if (!quiz) return
    const response = answer.trim()
    const isCorrect = response.toLowerCase() === quiz.answer.toLowerCase()
    setSubmitted(true)
    onSaveQuizAnswer(response)
    markResult(isCorrect)
    if (isCorrect) setCompleted(true)
  }

  const chooseOption = (option: string) => {
    if (submitted || !quiz) return
    const isCorrect = option === quiz.answer
    setAnswer(option)
    setSubmitted(true)
    onSaveQuizAnswer(option)
    markResult(isCorrect)
    if (isCorrect) setCompleted(true)
  }

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

  const renderQuiz = () => {
    if (!quiz) return null
    const isMultiple = quiz.type === 'multiple-choice'
    return (
      <div className="inline-quiz">
        {isMultiple ? (
          <div className="quiz-options">
            {quiz.options?.map((option, index) => {
              const isCorrectOption = option === quiz.answer
              const isChosen = answer === option
              const isIrrelevant = submitted && !isCorrectOption && !isChosen
              return (
                <button
                  key={option}
                  disabled={submitted}
                  className={[
                    isChosen ? 'selected' : '',
                    submitted && isCorrectOption ? 'correct' : '',
                    submitted && isChosen && !correct ? 'wrong' : '',
                    isIrrelevant ? 'dim' : '',
                  ].join(' ')}
                  onClick={() => chooseOption(option)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>{option}
                  {submitted && isCorrectOption && <Check size={17} />}
                  {submitted && isChosen && !correct && <X size={17} />}
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className={`fill-field ${submitted ? (correct ? 'correct' : 'wrong') : ''}`}>
              <input
                className="fill-answer"
                placeholder="Type your answer"
                value={answer}
                disabled={submitted}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && answer.trim()) submitQuiz()
                }}
              />
              {!submitted && (
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
            {submitted && (
              <div className={`quiz-result ${correct ? 'success' : 'retry'}`}>
                <strong>
                  {correct ? 'Correct' : `Incorrect, the answer is: ${quiz.answer}`}
                </strong>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="tiktok-row">
        <article className={`post-frame ${post.modality}`} id={`lesson-${post.id}`}>
          {post.privacy === 'only-me' && (
            <span className="post-privacy">Only you</span>
          )}

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
                  <p>
                    {post.postedBy === 'StudyQuest AI'
                      ? 'StudyQuest AI generated'
                      : `${post.postedBy ?? PROFILE_NAME} posted`}
                  </p>
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

          {post.modality === 'video' && post.video ? (
            <div className="lesson-media">
              <video
                ref={videoRef}
                src={post.video}
                playsInline
                muted={!soundOn}
                loop={false}
                preload="auto"
                onEnded={finishVideo}
                onClick={handleVideoControl}
              />
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
            </div>
          ) : (
            <div className="quiz-stack">
              <div className="quiz-header">
                <h2>{title}</h2>
              </div>
              {renderQuiz()}
            </div>
          )}

          <aside className="action-rail" aria-label="Post actions">
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

          {showContinueHint && (
            <p className="post-advance-hint" role="status">
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
