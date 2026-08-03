'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { Brain, Sparkles, User, Calendar, FileText, CheckSquare, Plus, ArrowLeft, ChevronDown, Pin, Trash2, Search, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { TextAnimate } from '@/components/ui/text-animate';
import { useStreamVideoClient } from '@stream-io/video-react-sdk';
import Plan, { Task } from '@/components/ui/agent-plan';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  mode?: 'search' | 'think';
  tasks?: Task[];
  durationMs?: number;
}

const generateSchedulingTasks = (title: string, duration: number, startsAt: string): Task[] => [
  {
    id: "gov-1",
    title: "Governed AI Security Audit",
    description: "Subjecting planned action to Next.js server-side policy and logical checks",
    status: "completed",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "gov-1.1",
        title: "Layer 1: Role Policy Check",
        description: `Verifying user permissions and scope guidelines for "${title}"`,
        status: "completed",
        priority: "high",
        tools: ["clerk-auth", "role-policy"]
      },
      {
        id: "gov-1.2",
        title: "Layer 4: Logical Constraints Validation",
        description: `Verifying date boundaries and duration (${duration} mins) validity`,
        status: "completed",
        priority: "high",
        tools: ["date-validator", "logical-constraint"]
      },
      {
        id: "gov-1.3",
        title: "Layer 5: Privacy & Security Risk Checks",
        description: "Auditing data exposure limits and destructive operation blocks",
        status: "completed",
        priority: "medium",
        tools: ["privacy-risk-analyzer", "security-risk-analyzer"]
      }
    ]
  },
  {
    id: "gov-2",
    title: "Execution Gateway Delivery",
    description: `Provisioning call room and syncing with upcoming feeds`,
    status: "completed",
    priority: "high",
    level: 0,
    dependencies: ["gov-1"],
    subtasks: [
      {
        id: "gov-2.1",
        title: "Provision Stream call room instance",
        description: `Allocating unique meeting UUID and setting custom metadata`,
        status: "completed",
        priority: "high",
        tools: ["stream-video-client"]
      },
      {
        id: "gov-2.2",
        title: "Inject event into Upcoming feeds",
        description: `Propagating meeting startsAt (${startsAt}) to calendar feeds`,
        status: "completed",
        priority: "medium",
        tools: ["calendar-context-writer"]
      }
    ]
  }
];

const generateTaskCreationTasks = (taskTitle: string): Task[] => [
  {
    id: "task-gov-1",
    title: "Verify Task Parameters",
    description: "Checking logical consistency of the requested task",
    status: "completed",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "task-gov-1.1",
        title: "Extract task entities",
        description: `Parsing title: "${taskTitle}" and setting dependencies`,
        status: "completed",
        priority: "high",
        tools: ["nlp-parser"]
      },
      {
        id: "task-gov-1.2",
        title: "Check duplicate tasks",
        description: "Auditing current task registers to avoid duplicates",
        status: "completed",
        priority: "medium",
        tools: ["deduplication-checker"]
      }
    ]
  },
  {
    id: "task-gov-2",
    title: "Task Persistence Registry",
    description: "Saving the task and syncing with team team updates",
    status: "completed",
    priority: "medium",
    level: 0,
    dependencies: ["task-gov-1"],
    subtasks: [
      {
        id: "task-gov-2.1",
        title: "Commit to cache database",
        description: "Writing task state safely to application storage",
        status: "completed",
        priority: "high",
        tools: ["cache-database-writer"]
      },
      {
        id: "task-gov-2.2",
        title: "Broadcast to collaborators",
        description: "Pushing updates to live activity streams",
        status: "completed",
        priority: "low",
        tools: ["notification-publisher"]
      }
    ]
  }
];

const getClientCustomTasks = (prompt: string): Task[] => {
  const lower = prompt.toLowerCase();
  const isMeeting = lower.includes('meeting') || lower.includes('schedule') || lower.includes('sync') || lower.includes('call') || lower.includes('book');
  const isTask = lower.includes('task') || lower.includes('todo') || lower.includes('to-do') || lower.includes('remind') || lower.includes('reminder');

  if (isMeeting) {
    return [
      {
        id: 'step-1',
        title: 'Meeting Intent Parsing',
        description: 'Extracting calendar slots, duration, and title context',
        status: 'in-progress',
        priority: 'high',
        level: 0,
        dependencies: [],
        subtasks: [
          {
            id: 'step-1.1',
            title: 'Parse time anchors',
            description: 'Resolving relative temporal parameters to strict dates',
            status: 'in-progress',
            priority: 'high',
            tools: ['llm-engine', 'temporal-parser'],
          },
          {
            id: 'step-1.2',
            title: 'Resolve participant list',
            description: 'Verifying availability and mapping names to roles',
            status: 'pending',
            priority: 'medium',
            tools: ['workspace-directories'],
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Meeting Governance Audit',
        description: 'Subjecting calendar request to policy and security validations',
        status: 'pending',
        priority: 'high',
        level: 0,
        dependencies: ['step-1'],
        subtasks: [
          {
            id: 'step-2.1',
            title: 'Verify host scheduling scope',
            description: 'Auditing host permissions and meeting tier limits',
            status: 'pending',
            priority: 'high',
            tools: ['clerk-auth', 'tier-validator'],
          },
          {
            id: 'step-2.2',
            title: 'Validate time boundaries',
            description: 'Ensuring slot falls within user scheduling guidelines',
            status: 'pending',
            priority: 'high',
            tools: ['date-validator', 'boundary-checker'],
          },
          {
            id: 'step-2.3',
            title: 'Check conflicting events',
            description: 'Scanning calendar register for double bookings',
            status: 'pending',
            priority: 'medium',
            tools: ['conflict-scanner'],
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Call Room Provisioning',
        description: 'Allocating resources on Stream and notifying participants',
        status: 'pending',
        priority: 'high',
        level: 0,
        dependencies: ['step-2'],
        subtasks: [
          {
            id: 'step-3.1',
            title: 'Provision video call token',
            description: 'Creating Stream room instance and custom credentials',
            status: 'pending',
            priority: 'high',
            tools: ['stream-video-client'],
          },
          {
            id: 'step-3.2',
            title: 'Broadcast calendar sync',
            description: 'Injecting call metadata into feeds and agendas',
            status: 'pending',
            priority: 'medium',
            tools: ['calendar-context-writer'],
          },
        ],
      },
    ];
  }

  if (isTask) {
    return [
      {
        id: 'step-1',
        title: 'Task Intent Processing',
        description: 'Analyzing description, priority levels, and checklist items',
        status: 'in-progress',
        priority: 'high',
        level: 0,
        dependencies: [],
        subtasks: [
          {
            id: 'step-1.1',
            title: 'Extract task metadata',
            description: 'Parsing description, tags, and dependencies from prompt',
            status: 'in-progress',
            priority: 'high',
            tools: ['llm-engine', 'intent-parser'],
          },
          {
            id: 'step-1.2',
            title: 'Deduplicate tasks',
            description: 'Auditing existing databases to avoid duplicate action items',
            status: 'pending',
            priority: 'medium',
            tools: ['deduplication-checker'],
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Task Validation Audit',
        description: 'Subjecting task to policy, limits, and ownership verification',
        status: 'pending',
        priority: 'high',
        level: 0,
        dependencies: ['step-1'],
        subtasks: [
          {
            id: 'step-2.1',
            title: 'Verify collaborator access',
            description: 'Auditing clerk permissions for assigned tasks',
            status: 'pending',
            priority: 'high',
            tools: ['clerk-auth', 'collab-policy'],
          },
          {
            id: 'step-2.2',
            title: 'Validate list boundaries',
            description: 'Ensuring task conforms to standard board guidelines',
            status: 'pending',
            priority: 'medium',
            tools: ['logical-constraint'],
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Registry Sync Gateway',
        description: 'Saving task state to cache and broadcasting live updates',
        status: 'pending',
        priority: 'high',
        level: 0,
        dependencies: ['step-2'],
        subtasks: [
          {
            id: 'step-3.1',
            title: 'Commit to application database',
            description: 'Writing persistent record to DB cache layer',
            status: 'pending',
            priority: 'high',
            tools: ['cache-database-writer'],
          },
          {
            id: 'step-3.2',
            title: 'Publish team notifications',
            description: 'Pushing update to active activity registers',
            status: 'pending',
            priority: 'low',
            tools: ['notification-publisher'],
          },
        ],
      },
    ];
  }

  // Fallback / General custom workflow
  return [
    {
      id: 'step-1',
      title: 'AI Request Processing',
      description: 'Interpreting your request and generating an action plan',
      status: 'in-progress',
      priority: 'high',
      level: 0,
      dependencies: [],
      subtasks: [
        {
          id: 'step-1.1',
          title: 'Parse user intent',
          description: 'Extracting entities and understanding the request context',
          status: 'in-progress',
          priority: 'high',
          tools: ['llm-engine', 'intent-parser'],
        },
        {
          id: 'step-1.2',
          title: 'Generate structured plan',
          description: 'Building execution plan from parsed intent',
          status: 'pending',
          priority: 'high',
          tools: ['action-planner'],
        },
      ],
    },
    {
      id: 'step-2',
      title: 'Governance Security Audit',
      description: 'Subjecting planned action to server-side policy and logical checks',
      status: 'pending',
      priority: 'high',
      level: 0,
      dependencies: ['step-1'],
      subtasks: [
        {
          id: 'step-2.1',
          title: 'Role Policy Check',
          description: 'Verifying user permissions and scope guidelines',
          status: 'pending',
          priority: 'high',
          tools: ['clerk-auth', 'role-policy'],
        },
        {
          id: 'step-2.2',
          title: 'Logical Constraints Validation',
          description: 'Verifying date boundaries and duration validity',
          status: 'pending',
          priority: 'high',
          tools: ['date-validator', 'logical-constraint'],
        },
        {
          id: 'step-2.3',
          title: 'Privacy & Security Risk Checks',
          description: 'Auditing data exposure limits and destructive operation blocks',
          status: 'pending',
          priority: 'medium',
          tools: ['privacy-risk-analyzer', 'security-risk-analyzer'],
        },
      ],
    },
    {
      id: 'step-3',
      title: 'Execution Gateway Delivery',
      description: 'Provisioning resources and completing the request',
      status: 'pending',
      priority: 'high',
      level: 0,
      dependencies: ['step-2'],
      subtasks: [
        {
          id: 'step-3.1',
          title: 'Provision resources',
          description: 'Allocating and configuring required services',
          status: 'pending',
          priority: 'high',
          tools: ['stream-video-client'],
        },
        {
          id: 'step-3.2',
          title: 'Sync with feeds',
          description: 'Propagating to calendar and activity feeds',
          status: 'pending',
          priority: 'medium',
          tools: ['calendar-context-writer'],
        },
      ],
    },
  ];
};

const groupThreads = (threads: any[]) => {
  const pinned = threads.filter(t => t.pinned);
  const unpinned = threads.filter(t => !t.pinned);

  const groups: { [key: string]: any[] } = {
    Today: [],
    Yesterday: [],
    'Last Week': [],
    Older: []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const lastWeekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  unpinned.forEach(thread => {
    const updatedTime = new Date(thread.updatedAt).getTime();
    if (updatedTime >= todayStart) {
      groups.Today.push(thread);
    } else if (updatedTime >= yesterdayStart) {
      groups.Yesterday.push(thread);
    } else if (updatedTime >= lastWeekStart) {
      groups['Last Week'].push(thread);
    } else {
      groups.Older.push(thread);
    }
  });

  return { pinned, groups };
};

export default function CastAIPage() {
  const { user } = useUser();
  const router = useRouter();
  const client = useStreamVideoClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const startTimeRef = useRef<number | null>(null);

  // Scoped AI Chat History & Floating Modal States
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchChatThreads = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/chat/history');
      if (res.ok) {
        const data = await res.json();
        setChatThreads(data.threads || []);
      }
    } catch (err) {
      console.error('[Fetch Chat Threads Error]:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistoryModal) {
      fetchChatThreads();
    }
  }, [showHistoryModal]);



  const loadChatThread = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chat/history?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = (data.messages || []).map((m: any) => ({
          id: m.id,
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          mode: m.content.startsWith('[Deep Search: ') ? 'search' : (m.content.startsWith('[Automate: ') ? 'think' : undefined)
        }));
        setMessages(loadedMessages);
        setActiveChatId(chatId);
        setShowHistoryModal(false);
      }
    } catch (err) {
      console.error('[Load Chat Thread Error]:', err);
    }
  };

  const togglePinChat = async (chatId: string, currentPinned: boolean) => {
    try {
      const res = await fetch('/api/chat/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, pinned: !currentPinned })
      });
      if (res.ok) {
        fetchChatThreads();
      }
    } catch (err) {
      console.error('[Toggle Pin Chat Error]:', err);
    }
  };

  const deleteChatThread = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chat/history?chatId=${chatId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
        fetchChatThreads();
      }
    } catch (err) {
      console.error('[Delete Chat Thread Error]:', err);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setShowHistoryModal(false);
  };

  const togglePlanExpanded = (msgId: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'a few seconds';
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const firstName = user?.firstName || 'there';

  const suggestionChips = [
    { label: "Summarize my last meeting", icon: FileText },
    { label: "Draft a weekly agenda", icon: Calendar },
    { label: "Check my action items", icon: CheckSquare },
    { label: "How to invite members?", icon: Sparkles }
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    startTimeRef.current = Date.now();

    let cleanText = text;
    let mode: 'search' | 'think' | undefined = undefined;

    if (text.startsWith('[Deep Search: ') && text.endsWith(']')) {
      cleanText = text.substring('[Deep Search: '.length, text.length - 1);
      mode = 'search';
    } else if (text.startsWith('[Automate: ') && text.endsWith(']')) {
      cleanText = text.substring('[Automate: '.length, text.length - 1);
      mode = 'think';
    } else {
      // Fallback auto-detection for raw text triggers (e.g. suggestions, direct speech, API calls)
      const lower = text.toLowerCase();
      const automateKeywords = [
        'schedule', 'create', 'book', 'setup', 'set up', 'event', 'meeting', 
        'appointment', 'calendar', 'remind', 'reminder', 'todo', 'to-do', 
        'task', 'invite', 'call room', 'sync'
      ];
      const searchKeywords = [
        'analyze', 'analysis', 'deep search', 'research', 'audit', 'investigate', 
        'investigation', 'explain', 'why', 'insights', 'compare', 'comparison', 
        'report', 'overview', 'details about'
      ];

      if (automateKeywords.some(keyword => lower.includes(keyword))) {
        mode = 'think';
      } else if (searchKeywords.some(keyword => lower.includes(keyword))) {
        mode = 'search';
      }
    }

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      mode
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const aiMessageId = `msg-ai-${Date.now()}`;
    const initialAiMsg: Message = {
      id: aiMessageId,
      sender: 'ai',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      mode,
      tasks: mode === 'think' ? getClientCustomTasks(cleanText) : undefined
    };

    setMessages((prev) => [...prev, initialAiMsg]);

    let currentChatId = activeChatId;

    // Save user message to database history
    try {
      const saveRes = await fetch('/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: currentChatId || 'new',
          role: 'user',
          content: cleanText
        })
      });
      if (saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.success) {
          currentChatId = saveData.chatId;
          setActiveChatId(currentChatId);
        }
      }
    } catch (saveErr) {
      console.error('[Error saving user message to history]:', saveErr);
    }

    try {
      const formattedHistory = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));
      formattedHistory.push({ role: 'user', content: text });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: formattedHistory,
          isThinking: mode === 'search' || mode === 'think',
          mode: mode,
          userId: user?.id,
          currentDateTime: new Date().toString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body has no reader');

      const decoder = new TextDecoder();
      let streamBuffer = '';

      const mapStatus = (status: string) => {
        if (status === 'queued') return 'pending';
        if (status === 'running') return 'in-progress';
        if (status === 'succeeded') return 'completed';
        if (status === 'failed') return 'failed';
        if (status === 'blocked') return 'failed';
        return 'pending';
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });

        const parts = streamBuffer.split('\n\n');
        streamBuffer = parts.pop() || '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          const eventLines = trimmed.split('\n');
          let eventType = '';
          let eventDataRaw = '';

          for (const line of eventLines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventDataRaw = line.substring(5).trim();
            }
          }

          if (!eventType || !eventDataRaw) continue;

          try {
            const eventData = JSON.parse(eventDataRaw);

            if (eventType === 'mode_selected') {
              const detectedMode = eventData.mode; // 'chat' | 'deep_search' | 'automate'
              const clientMode = detectedMode === 'automate' ? 'think' : (detectedMode === 'deep_search' ? 'search' : undefined);
              
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== aiMessageId) return msg;
                  
                  let updatedTasks = msg.tasks;
                  if (clientMode === 'think' && !updatedTasks) {
                    updatedTasks = getClientCustomTasks(cleanText);
                  }
                  
                  return { ...msg, mode: clientMode, tasks: updatedTasks };
                })
              );
            } else if (eventType === 'plan_generated') {
              const uiTasks = eventData.tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description || '',
                status: mapStatus(t.status),
                priority: t.priority || 'medium',
                level: 0,
                dependencies: t.dependencies || [],
                subtasks: (t.subtasks || []).map((st: any) => ({
                  id: st.id,
                  title: st.title,
                  description: st.description || '',
                  status: mapStatus(st.status),
                  priority: st.priority || 'medium',
                  tools: st.tools || []
                }))
              }));

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, tasks: uiTasks, mode: 'think' } : msg
                )
              );
            } else if (eventType === 'task_update') {
              const updatedStatus = mapStatus(eventData.status);

              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== aiMessageId || !msg.tasks) return msg;

                  const updatedTasks = msg.tasks.map((task) => {
                    if (task.id === eventData.id) {
                      let updatedSubtasks = task.subtasks;
                      if (updatedStatus === 'failed') {
                        updatedSubtasks = task.subtasks.map((st) => 
                          st.status === 'pending' || st.status === 'in-progress'
                            ? { ...st, status: 'failed' }
                            : st
                        );
                      }
                      return {
                        ...task,
                        status: updatedStatus,
                        subtasks: updatedSubtasks
                      };
                    }

                    const subtaskIndex = task.subtasks.findIndex((st) => st.id === eventData.id);
                    if (subtaskIndex !== -1) {
                      const updatedSubtasks = task.subtasks.map((st) =>
                        st.id === eventData.id ? { ...st, status: updatedStatus } : st
                      );

                      const allSubtasksCompleted = updatedSubtasks.every((s) => s.status === 'completed');
                      const anySubtaskFailed = updatedSubtasks.some((s) => s.status === 'failed');

                      let parentStatus = task.status;
                      if (allSubtasksCompleted) {
                        parentStatus = 'completed';
                      } else if (anySubtaskFailed) {
                        parentStatus = 'failed';
                      } else if (updatedStatus === 'in-progress') {
                        parentStatus = 'in-progress';
                      }

                      return {
                        ...task,
                        subtasks: updatedSubtasks,
                        status: parentStatus
                      };
                    }

                    return task;
                  });

                  return { ...msg, tasks: updatedTasks };
                })
              );
            } else if (eventType === 'final_message') {
              let aiText = eventData.text || 'I could not process that request.';
              
              if (eventData.actionPlans && Array.isArray(eventData.actionPlans) && eventData.actionPlans.length > 0) {
                const results: string[] = [];
                let hasErrors = false;

                for (let i = 0; i < eventData.actionPlans.length; i++) {
                  const plan = eventData.actionPlans[i];
                  const { action, arguments: args } = plan;

                  if (action === 'createMeeting' && client) {
                    try {
                      const meetingId = crypto.randomUUID();
                      const call = client.call('default', meetingId);
                      
                      let startsAt = new Date().toISOString();
                      if (args.startsAt) {
                        try {
                          startsAt = new Date(args.startsAt).toISOString();
                        } catch (e) {
                          console.error("Invalid startsAt format:", args.startsAt);
                        }
                      }
                      const title = args.title || 'AI Scheduled Meeting';
                      const duration = Number(args.duration || 60);

                      await call.getOrCreate({
                        data: {
                          starts_at: startsAt,
                          custom: {
                            title: title,
                            description: title,
                            duration: duration,
                          },
                        },
                      });

                      // Sync scheduled meeting into Appwrite schedules database collection
                      await fetch('/api/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          meetingId,
                          title,
                          description: title,
                          startsAt,
                          duration,
                          meetingType: 'ai'
                        })
                      }).catch(err => console.error('[Error syncing schedule to DB]:', err));

                      const formattedDate = new Date(startsAt).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      });

                      results.push(`Meeting ${i + 1}: ${title}\n- Starts At: ${formattedDate}\n- Duration: ${duration} minutes\n- Meeting ID: \`${meetingId}\``);
                    } catch (err: any) {
                      console.error(`Failed to create meeting ${i + 1} in Stream:`, err);
                      hasErrors = true;
                      results.push(`Meeting ${i + 1} Failed\nError: ${err.message || err}`);
                    }
                  } else if (action === 'updateMeeting' && client) {
                    try {
                      const { meetingId, updates } = args;
                      if (!meetingId) {
                        throw new Error('Meeting ID is required to update a meeting.');
                      }
                      const call = client.call('default', meetingId);
                      
                      const updateData: any = {};
                      if (updates?.startsAt) {
                        updateData.starts_at = updates.startsAt;
                      }
                      
                      if (updates?.title || updates?.duration !== undefined) {
                        updateData.custom = {};
                        if (updates.title) {
                          updateData.custom.title = updates.title;
                          updateData.custom.description = updates.title;
                        }
                        if (updates.duration !== undefined) {
                          updateData.custom.duration = Number(updates.duration);
                        }
                      }

                      await call.update(updateData);

                      // Sync updated meeting details into Appwrite schedules database collection
                      const syncTitle = updates?.title || call.state?.custom?.title || 'Meeting';
                      const syncStartsAt = updates?.startsAt || call.state?.startedAt?.toISOString() || new Date().toISOString();
                      const syncDuration = updates?.duration !== undefined ? Number(updates.duration) : (call.state?.custom?.duration || 60);

                      await fetch('/api/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          meetingId,
                          title: syncTitle,
                          description: syncTitle,
                          startsAt: syncStartsAt,
                          duration: syncDuration,
                          meetingType: 'ai'
                        })
                      }).catch(err => console.error('[Error syncing updated schedule to DB]:', err));

                      const formattedDate = updates?.startsAt
                        ? new Date(updates.startsAt).toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : undefined;

                      let details = '';
                      if (updates?.title) details += `\n- New Title: ${updates.title}`;
                      if (formattedDate) details += `\n- New Starts At: ${formattedDate}`;
                      if (updates?.duration !== undefined) details += `\n- New Duration: ${updates.duration} minutes`;

                      results.push(`Meeting Updated Successfully!\n- Meeting ID: \`${meetingId}\`${details}`);
                    } catch (err: any) {
                      console.error('Failed to update meeting in Stream:', err);
                      hasErrors = true;
                      results.push(`Meeting Update Failed\nError: ${err.message || err}`);
                    }
                  }
                }

                if (!hasErrors) {
                  aiText = `CastAI scheduled the meetings successfully!\n\n` + results.join('\n\n') + `\n\nThe events have been successfully scheduled and are now visible on your upcoming calendar dashboard.`;
                } else {
                  aiText = `CastAI finished executing the scheduled actions with some errors:\n\n` + results.join('\n\n');
                }
              } else if (eventData.actionPlan) {
                const { action, arguments: args } = eventData.actionPlan;
                
                if (action === 'createMeeting' && client) {
                  try {
                    const meetingId = crypto.randomUUID();
                    const call = client.call('default', meetingId);
                    
                    let startsAt = new Date().toISOString();
                    if (args.startsAt) {
                      try {
                        startsAt = new Date(args.startsAt).toISOString();
                      } catch (e) {
                        console.error("Invalid startsAt format:", args.startsAt);
                      }
                    }
                    const title = args.title || 'AI Scheduled Meeting';
                    const duration = Number(args.duration || 60);

                    await call.getOrCreate({
                      data: {
                        starts_at: startsAt,
                        custom: {
                          title: title,
                          description: title,
                          duration: duration,
                        },
                      },
                    });

                    // Sync scheduled meeting into Appwrite schedules database collection
                    await fetch('/api/schedules', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId,
                        title,
                        description: title,
                        startsAt,
                        duration,
                        meetingType: 'ai'
                      })
                    }).catch(err => console.error('[Error syncing schedule to DB]:', err));

                    const formattedDate = new Date(startsAt).toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    aiText = `CastAI scheduled the meeting successfully!

**Title**: ${title}
**Starts At**: ${formattedDate}
**Duration**: ${duration} minutes
**Meeting ID**: \`${meetingId}\`

The event has been successfully scheduled and is now visible on your upcoming calendar dashboard.`;
                  } catch (err: any) {
                    console.error('Failed to create meeting in Stream:', err);
                    aiText = `Error: Action plan approved by Governance, but execution in Stream Client failed: ${err.message || err}`;
                  }
                } else if (action === 'updateMeeting' && client) {
                  try {
                    const { meetingId, updates } = args;
                    if (!meetingId) {
                      throw new Error('Meeting ID is required to update a meeting.');
                    }
                    const call = client.call('default', meetingId);
                    
                    const updateData: any = {};
                    if (updates?.startsAt) {
                      updateData.starts_at = updates.startsAt;
                    }
                    
                    if (updates?.title || updates?.duration !== undefined) {
                      updateData.custom = {};
                      if (updates.title) {
                        updateData.custom.title = updates.title;
                        updateData.custom.description = updates.title;
                      }
                      if (updates.duration !== undefined) {
                        updateData.custom.duration = Number(updates.duration);
                      }
                    }

                    await call.update(updateData);

                    // Sync updated meeting details into Appwrite schedules database collection
                    const syncTitle = updates?.title || call.state?.custom?.title || 'Meeting';
                    const syncStartsAt = updates?.startsAt || call.state?.startedAt?.toISOString() || new Date().toISOString();
                    const syncDuration = updates?.duration !== undefined ? Number(updates.duration) : (call.state?.custom?.duration || 60);

                    await fetch('/api/schedules', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId,
                        title: syncTitle,
                        description: syncTitle,
                        startsAt: syncStartsAt,
                        duration: syncDuration,
                        meetingType: 'ai'
                      })
                    }).catch(err => console.error('[Error syncing updated schedule to DB]:', err));

                    const formattedDate = updates?.startsAt
                      ? new Date(updates.startsAt).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : undefined;

                    let details = '';
                    if (updates?.title) details += `\n**New Title**: ${updates.title}`;
                    if (formattedDate) details += `\n**New Starts At**: ${formattedDate}`;
                    if (updates?.duration !== undefined) details += `\n**New Duration**: ${updates.duration} minutes`;

                    aiText = `CastAI updated the meeting successfully!

**Meeting ID**: \`${meetingId}\`${details}

The event modifications have been successfully saved.`;
                  } catch (err: any) {
                    console.error('Failed to update meeting in Stream:', err);
                    aiText = `Error: Action plan approved by Governance, but execution in Stream Client failed: ${err.message || err}`;
                  }
                }
              }

              const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, text: aiText, durationMs } : msg
                )
              );

              // Save assistant message to database history
              if (currentChatId) {
                fetch('/api/chat/history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chatId: currentChatId,
                    role: 'assistant',
                    content: aiText
                  })
                }).catch(err => console.error('[Error saving assistant response to history]:', err));
              }
            } else if (eventType === 'error_message') {
              const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId 
                    ? { ...msg, text: `Error: ${eventData.error?.message || 'A streaming error occurred.'}`, durationMs } 
                    : msg
                )
              );
            }
          } catch (jsonErr) {
            console.error('Error parsing SSE data JSON:', jsonErr, eventDataRaw);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching chat completion stream:', error);
      const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId 
            ? { ...msg, text: `Sorry, I encountered an issue connecting to the chat completion service: ${error.message || error}`, durationMs } 
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-background overflow-hidden font-geist">
      <NoiseTexture className="opacity-[0.15]" />
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `linear-gradient(to right, #c4cccc 1px, transparent 1px), linear-gradient(to bottom, #c4cccc 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 50%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 50%)',
        }}
      />

      {messages.length === 0 ? (
        // Non-scrollable Empty Welcome Screen & Input together in the same div
        <div className="flex-1 flex flex-col justify-between items-center relative z-10 px-4 md:px-6 lg:px-8 py-10 max-h-full overflow-hidden select-none">
          {/* Spacer to push content down slightly for balance */}
          <div className="flex-1" />

          {/* Clean Central Container */}
          <div className="w-full max-w-[850px] flex flex-col items-center gap-12">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center flex flex-col items-center font-geist"
            >
              <h1 className="text-5xl md:text-6xl lg:text-[88px] font-geist font-normal text-black tracking-[-1.8px] leading-[1.05]">
                How can I assist with your meetings?
              </h1>
              <TextAnimate
                as="h2"
                animation="fadeIn"
                by="word"
                className="text-[18px] md:text-[20px] font-geist font-normal text-[#475569] mt-8 leading-[32.5px] tracking-normal text-center"
              >
                Schedule meetings, manage events, and coordinate collaboration from one place.
              </TextAnimate>
            </motion.div>

            {/* Prompt Box - Keep the box constrained to a readable reading width */}
            <div className="w-full max-w-[720px] relative">
              <PromptInputBox 
                onSend={handleSend}
                isLoading={isTyping}
                placeholder="Ask CastAI anything about meetings, notes, or tasks..."
                className="border-slate-200 shadow-none"
                onHistoryClick={() => setShowHistoryModal(prev => !prev)}
              />
            </div>
          </div>

          <div className="flex-1" />
        </div>
      ) : (
        // Chat Mode - Scrollable conversation list and fixed bottom input bar
        <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 min-h-0 flex flex-col">
          <div className="flex-1 flex justify-center px-4 md:px-6 lg:px-8 py-6">
            <div className="w-full max-w-[720px] flex flex-col gap-6 py-6 pb-36">
              {messages.map((msg) => {
                // Don't render empty AI placeholder messages — the typing indicator handles the loading state
                if (msg.sender === 'ai' && !msg.text && !msg.tasks) return null;

                return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="size-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                      <img src="/logo/Main.svg" alt="CastAI" className="size-6 object-contain" />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[80%] gap-1">
                    {msg.sender === 'user' ? (
                      <div className="px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm border bg-slate-900 text-white border-slate-900 rounded-tr-none">
                        <p className="whitespace-pre-line">{msg.text}</p>
                      </div>
                    ) : (
                      <div className="py-2 text-[14px] leading-relaxed text-slate-800 flex flex-col gap-3">
                        {msg.text && <p className="whitespace-pre-line">{msg.text}</p>}
                        
                        {/* If text is empty (processing in progress), render the plan directly */}
                        {!msg.text && msg.tasks && (
                          <div className="mt-2 w-full max-w-[650px]">
                            <Plan tasks={msg.tasks} />
                          </div>
                        )}

                        {/* If text is present (completed), render collapsible worked for dropdown */}
                        {msg.text && msg.tasks && (
                          <div className="mt-2 flex flex-col gap-2">
                            <button
                              onClick={() => togglePlanExpanded(msg.id)}
                              className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-800 transition-colors w-fit font-medium"
                            >
                              <ChevronDown className={`size-3.5 transition-transform duration-200 ${expandedPlans[msg.id] ? 'rotate-180' : ''}`} />
                              <span>worked for {formatDuration(msg.durationMs)}</span>
                            </button>
                            <AnimatePresence initial={false}>
                              {expandedPlans[msg.id] && (
                                <motion.div
                                  key={`expanded-plan-${msg.id}`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-1 w-full max-w-[650px]">
                                    <Plan tasks={msg.tasks} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex items-center gap-1.5 px-1 mt-0.5 text-[10px] text-slate-400 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.mode === 'search' && (
                        <span className="font-normal text-[#1EAEDB]">Deep Search</span>
                      )}
                      {msg.mode === 'think' && (
                        <span className="font-normal text-[#8B5CF6]">Automate</span>
                      )}
                      {msg.mode && <span className="text-slate-300">•</span>}
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'ai' && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="font-normal text-emerald-600">worked for {formatDuration(msg.durationMs)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="size-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                      {user?.imageUrl ? (
                        <img src={user.imageUrl} alt={user.fullName || 'User'} className="size-full object-cover" />
                      ) : (
                        <User className="size-4 text-slate-600" />
                      )}
                    </div>
                  )}
                </motion.div>
                );
              })}

              {isTyping && !messages.some(m => m.sender === 'ai' && !m.text && m.mode === 'think') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 justify-start items-center"
                >
                  <div className="size-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                    <img src="/logo/Main.svg" alt="CastAI" className="size-6 object-contain" />
                  </div>
                  <div className="py-2 flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                    <div className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                    <div className="size-1.5 rounded-full bg-slate-400 animate-bounce" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area at the bottom - sticky floating container in the same scrollable div */}
          <div className="sticky bottom-0 z-20 w-full flex justify-center pb-6 pt-10 px-4 md:px-6 lg:px-8 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
            <div className="w-full max-w-[720px] flex flex-col gap-4 pointer-events-auto">
              <div className="relative">
                <PromptInputBox 
                  onSend={handleSend}
                  isLoading={isTyping}
                  placeholder="Ask CastAI anything about meetings, notes, or tasks..."
                  className="border-slate-200 shadow-none"
                  onHistoryClick={() => setShowHistoryModal(prev => !prev)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Convo History Modal (Gemini IDE style) */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            key="history-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop overlay */}
            <motion.div
              key="history-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              key="history-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-[550px] max-h-[80vh] flex flex-col bg-white/95 border border-slate-200/80 shadow-2xl rounded-2xl overflow-hidden z-10"
            >
              {/* Header Search Area */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <Search className="size-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search all convos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-base bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={startNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shrink-0 transition-all shadow-sm"
                >
                  <Plus className="size-3.5" />
                  <span>New chat</span>
                </button>
              </div>

              {/* Body List Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar min-h-0">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                    <Loader2 className="size-8 animate-spin text-slate-500" />
                    <span className="text-sm font-medium">Loading history...</span>
                  </div>
                ) : (() => {
                  const filteredThreads = chatThreads.filter(thread => 
                    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredThreads.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                        <MessageSquare className="size-10 text-slate-300 mb-2" />
                        <span className="text-sm font-medium">No conversations found</span>
                      </div>
                    );
                  }

                  const { pinned, groups } = groupThreads(filteredThreads);

                  return (
                    <>
                      {/* Pinned Section */}
                      {pinned.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Pinned</h3>
                          <div className="space-y-1">
                            {pinned.map((thread) => (
                              <div
                                key={thread.id}
                                className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                onClick={() => loadChatThread(thread.id)}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <MessageSquare className="size-4 text-slate-400 shrink-0" />
                                  <span className="text-sm font-medium text-slate-700 truncate">{thread.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinChat(thread.id, thread.pinned);
                                    }}
                                    className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                    title="Unpin conversation"
                                  >
                                    <Pin className="size-3.5 fill-slate-400 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteChatThread(thread.id);
                                    }}
                                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                                    title="Delete conversation"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Date Groups */}
                      {Object.entries(groups).map(([groupName, threads]) => {
                        if (threads.length === 0) return null;
                        return (
                          <div key={groupName} className="space-y-2">
                            <h3 className="text-xs font-semibold text-slate-400 tracking-wider px-1">{groupName}</h3>
                            <div className="space-y-1">
                              {threads.map((thread) => (
                                <div
                                  key={thread.id}
                                  className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                  onClick={() => loadChatThread(thread.id)}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <MessageSquare className="size-4 text-slate-400 shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 truncate">{thread.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePinChat(thread.id, thread.pinned);
                                      }}
                                      className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                      title="Pin conversation"
                                    >
                                      <Pin className="size-3.5 text-slate-400 hover:text-slate-600" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChatThread(thread.id);
                                      }}
                                      className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                                      title="Delete conversation"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
