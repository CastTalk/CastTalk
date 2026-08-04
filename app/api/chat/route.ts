import { NextResponse } from 'next/server';
import { fetchOpenRouterCompletion, OpenRouterMessage } from '@/lib/openrouter';
import { systemPromptTemplate } from '@/ai-context/prompts/systemPrompt';
import { ActionPlanner } from '@/ai-context/planner/actionPlanner';
import { checkPrivacyPolicy } from '@/ai-context/policies/privacy.policy';
import { EventStreamDispatcher, TaskState } from '@/lib/agent-sse';
import { appwrite } from '@/lib/appwrite';
import { Query } from 'node-appwrite';

async function getAIUserContext(userId: string): Promise<string> {
  if (!userId) return '';
  try {
    const DATABASE_ID = 'castdb';
    
    // 1. Fetch user schedules
    let schedulesText = 'None';
    try {
      const schedulesRes = await appwrite.databases.listDocuments(
        DATABASE_ID,
        'schedules',
        [
          Query.equal('createdBy', userId),
          Query.limit(100)
        ]
      );
      if (schedulesRes.documents.length > 0) {
        schedulesText = schedulesRes.documents.map((d: any) => 
          `- ID: ${d.meetingId}, Title: ${d.title}, Starts At: ${d.startsAt}, Duration: ${d.duration} mins, Type: ${d.meetingType}`
        ).join('\n');
      }
    } catch (err) {
      console.warn('[AI User Context] Failed to fetch schedules:', err);
    }

    // 2. Fetch user tasks
    let tasksText = 'None';
    try {
      const tasksRes = await appwrite.databases.listDocuments(
        DATABASE_ID,
        'tasks',
        [
          Query.equal('userId', userId),
          Query.limit(100)
        ]
      );
      if (tasksRes.documents.length > 0) {
        tasksText = tasksRes.documents.map((d: any) => 
          `- Title: ${d.title}, Status: ${d.status}, Due Date: ${d.dueDate || 'N/A'}`
        ).join('\n');
      }
    } catch (err) {
      console.warn('[AI User Context] Failed to fetch tasks:', err);
    }

    // 3. Fetch user recordings (linked via meetingId of schedules created by the user)
    let recordingsText = 'None';
    try {
      const schedulesRes = await appwrite.databases.listDocuments(
        DATABASE_ID,
        'schedules',
        [
          Query.equal('createdBy', userId),
          Query.limit(100)
        ]
      );
      const meetingIds = schedulesRes.documents.map((d: any) => d.meetingId);
      if (meetingIds.length > 0) {
        const recordingsRes = await appwrite.databases.listDocuments(
          DATABASE_ID,
          'recordings',
          [
            Query.equal('meetingId', meetingIds),
            Query.limit(100)
          ]
        );
        if (recordingsRes.documents.length > 0) {
          recordingsText = recordingsRes.documents.map((d: any) => 
            `- Title: ${d.title}, URL: ${d.url}, Duration: ${d.duration} mins, Created At: ${d.createdAt}`
          ).join('\n');
        }
      }
    } catch (err) {
      console.warn('[AI User Context] Failed to fetch recordings:', err);
    }

    return `
=== USER RELEVANT CONTEXT (DATABASE READ-ONLY ACCESS) ===
The following information is retrieved from the database and belongs strictly to the interacting user. You may use this context to answer their questions or plan actions. Do not reference other users' data.

Upcoming Schedules/Meetings:
${schedulesText}

Tasks:
${tasksText}

Recordings:
${recordingsText}
========================================================`;
  } catch (err) {
    console.error('[AI User Context] Global error:', err);
    return '';
  }
}

function generateFallbackTasks(prompt: string, isCompleted: boolean = false) {
  const lower = prompt.toLowerCase();
  const isMeeting = lower.includes('meeting') || lower.includes('schedule') || lower.includes('sync') || lower.includes('call') || lower.includes('book');
  const isTask = lower.includes('task') || lower.includes('todo') || lower.includes('to-do') || lower.includes('remind') || lower.includes('reminder');
  const isUpdate = lower.includes('update') || lower.includes('edit') || lower.includes('change') || lower.includes('reschedule') || lower.includes('modify');

  const step1Status = isCompleted ? ('succeeded' as TaskState) : ('queued' as TaskState);
  const step1SubStatus = isCompleted ? ('succeeded' as TaskState) : ('queued' as TaskState);

  // Extract entities from user prompt dynamically
  let extractedTitle = "";
  const titleMatch = prompt.match(/(?:called|named|titled|about)\s+["']?([A-Za-z0-9_.-]+(?:[\s]+[A-Za-z0-9_.-]+){0,2})["']?/i);
  if (titleMatch) {
    const parts = titleMatch[1].split(/\s+/);
    const stopWords = ['and', 'is', 'for', 'at', 'with', 'in', 'on', 'to', 'tomorrow', 'today', 'pm', 'am'];
    const cleanParts = [];
    for (const part of parts) {
      if (stopWords.includes(part.toLowerCase())) break;
      cleanParts.push(part);
    }
    if (cleanParts.length > 0) {
      extractedTitle = cleanParts.join(' ');
    }
  }
  
  if (!extractedTitle) {
    const scheduleMatch = prompt.match(/(?:schedule|create|book|setup)\s+["']?([A-Za-z0-9_.-]+(?:[\s]+[A-Za-z0-9_.-]+){0,1})\s+(?:meeting|sync|call|session)/i);
    if (scheduleMatch) {
      extractedTitle = scheduleMatch[1].trim();
    }
  }

  // Extract Time
  let extractedTime = "";
  const timeMatch = prompt.match(/(\d{1,2}:?\d{2}?\s*(?:am|pm|AM|PM))/i);
  if (timeMatch) {
    extractedTime = timeMatch[1].trim();
  } else {
    const relativeWords = ['tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const rw of relativeWords) {
      if (lower.includes(rw)) {
        extractedTime = rw.charAt(0).toUpperCase() + rw.slice(1);
        break;
      }
    }
  }

  // Extract Duration
  let extractedDuration = "";
  const durationMatch = prompt.match(/(\d+)\s*(?:hour|hr|minute|min)s?/i);
  if (durationMatch) {
    extractedDuration = durationMatch[0].trim();
  }

  const displayTitle = extractedTitle ? `"${extractedTitle}"` : (isTask ? "Task" : "Meeting");
  const displayTime = extractedTime ? ` at ${extractedTime}` : "";
  const displayDuration = extractedDuration ? ` (${extractedDuration})` : "";

  // 1. Meeting Update Path
  if (isMeeting && isUpdate) {
    return [
      {
        id: 'step-1',
        title: 'Identifying meeting update parameters',
        description: `Parsing edits requested for the meeting ${displayTitle}${displayTime}${displayDuration}`,
        status: step1Status,
        priority: 'high' as const,
        dependencies: [],
        subtasks: [
          {
            id: 'step-1.1',
            title: 'Parse requested updates',
            description: `Extracting modifications to apply to ${displayTitle}`,
            status: step1SubStatus,
            priority: 'high' as const,
            tools: ['llm-engine', 'intent-parser'],
          },
          {
            id: 'step-1.2',
            title: 'Locate active meeting context',
            description: 'Resolving targets and scheduling parameters',
            status: step1SubStatus,
            priority: 'medium' as const,
            tools: ['workspace-directories'],
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Governance Checks & Conflict Scanner',
        description: 'Subjecting meeting modifications to compliance policy rules',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-1'],
        subtasks: [
          {
            id: 'step-2.1',
            title: 'Check user permission credentials',
            description: `Ensuring user is authorized to edit ${displayTitle}`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['clerk-auth', 'role-policy'],
          },
          {
            id: 'step-2.2',
            title: 'Scan calendar for scheduling conflicts',
            description: `Checking calendar slots for ${displayTitle}${displayTime}`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['conflict-scanner'],
          },
          {
            id: 'step-2.3',
            title: 'Audit target safety compliance',
            description: 'Verifying that the update conforms to safety standards',
            status: 'queued' as TaskState,
            priority: 'medium' as const,
            tools: ['privacy-risk-analyzer'],
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Applying Meeting Modifications',
        description: 'Updating details on Stream and notifying invitees',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-2'],
        subtasks: [
          {
            id: 'step-3.1',
            title: 'Execute update on Stream client',
            description: 'Applying new values to the Stream call object',
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['stream-video-client'],
          },
          {
            id: 'step-3.2',
            title: 'Publish updated invite details',
            description: `Broadcasting notifications for the updated slot${displayTime}`,
            status: 'queued' as TaskState,
            priority: 'medium' as const,
            tools: ['calendar-context-writer'],
          },
        ],
      },
    ];
  }

  // 2. Meeting Creation Path
  if (isMeeting) {
    return [
      {
        id: 'step-1',
        title: 'Identifying meeting schedule',
        description: `Extracting parameters for ${displayTitle}${displayTime}${displayDuration}`,
        status: step1Status,
        priority: 'high' as const,
        dependencies: [],
        subtasks: [
          {
            id: 'step-1.1',
            title: 'Parse scheduling parameters',
            description: `Resolving slot ${extractedTime || 'target slot'} and title ${displayTitle}`,
            status: step1SubStatus,
            priority: 'high' as const,
            tools: ['llm-engine', 'temporal-parser'],
          },
          {
            id: 'step-1.2',
            title: 'Resolve invitee listings',
            description: 'Mapping attendees and checking their availability',
            status: step1SubStatus,
            priority: 'medium' as const,
            tools: ['workspace-directories'],
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Checking calendar for conflict',
        description: 'Verifying slot availability and host permissions',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-1'],
        subtasks: [
          {
            id: 'step-2.1',
            title: 'Verify user schedule credentials',
            description: `Auditing permissions to schedule a ${extractedDuration || 'new'} meeting`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['clerk-auth', 'tier-validator'],
          },
          {
            id: 'step-2.2',
            title: 'Scan calendar database for conflict',
            description: `Ensuring no overlap exists at ${extractedTime || 'the requested time'}`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['conflict-scanner'],
          },
          {
            id: 'step-2.3',
            title: 'Audit compliance checks',
            description: 'Subjecting proposed invite to standard privacy constraints',
            status: 'queued' as TaskState,
            priority: 'medium' as const,
            tools: ['date-validator', 'boundary-checker'],
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Making the meeting',
        description: 'Provisioning call room and dispatching inviter cards',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-2'],
        subtasks: [
          {
            id: 'step-3.1',
            title: 'Provision video call room token',
            description: `Creating call room instance for ${displayTitle}`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['stream-video-client'],
          },
          {
            id: 'step-3.2',
            title: 'Broadcast scheduled invite',
            description: `Adding invite slot${displayTime} to upcoming dashboards`,
            status: 'queued' as TaskState,
            priority: 'medium' as const,
            tools: ['calendar-context-writer'],
          },
        ],
      },
    ];
  }

  // 3. Task Creation/Update Path
  if (isTask) {
    return [
      {
        id: 'step-1',
        title: 'Identifying task parameters',
        description: `Parsing descriptions and priority for task ${displayTitle}`,
        status: step1Status,
        priority: 'high' as const,
        dependencies: [],
        subtasks: [
          {
            id: 'step-1.1',
            title: 'Extract task checklist content',
            description: `Analyzing items and dependencies for ${displayTitle}`,
            status: step1SubStatus,
            priority: 'high' as const,
            tools: ['llm-engine', 'intent-parser'],
          },
          {
            id: 'step-1.2',
            title: 'Audit duplicate entries',
            description: `Ensuring task ${displayTitle} does not already exist`,
            status: step1SubStatus,
            priority: 'medium' as const,
            tools: ['deduplication-checker'],
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Checking constraints & limits',
        description: 'Subjecting task checklist to validation guidelines',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-1'],
        subtasks: [
          {
            id: 'step-2.1',
            title: 'Verify assignee credentials',
            description: 'Checking access rights for team members',
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['clerk-auth', 'collab-policy'],
          },
          {
            id: 'step-2.2',
            title: 'Audit safety policy bounds',
            description: 'Ensuring task descriptions comply with guidelines',
            status: 'queued' as TaskState,
            priority: 'medium' as const,
            tools: ['logical-constraint'],
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Making the task entry',
        description: 'Writing record to cache database and notifying members',
        status: 'queued' as TaskState,
        priority: 'high' as const,
        dependencies: ['step-2'],
        subtasks: [
          {
            id: 'step-3.1',
            title: 'Commit task to application registry',
            description: `Saving task ${displayTitle} to database cache`,
            status: 'queued' as TaskState,
            priority: 'high' as const,
            tools: ['cache-database-writer'],
          },
          {
            id: 'step-3.2',
            title: 'Sync board activities',
            description: 'Publishing new card to workspace boards',
            status: 'queued' as TaskState,
            priority: 'low' as const,
            tools: ['notification-publisher'],
          },
        ],
      },
    ];
  }

  // 4. Fallback / General custom workflow
  return [
    {
      id: 'step-1',
      title: 'Identifying request intent',
      description: 'Interpreting parameters and scope details',
      status: step1Status,
      priority: 'high' as const,
      dependencies: [],
      subtasks: [
        {
          id: 'step-1.1',
          title: 'Parse input parameters',
          description: 'Extracting entities from request',
          status: step1SubStatus,
          priority: 'high' as const,
          tools: ['llm-engine', 'intent-parser'],
        },
        {
          id: 'step-1.2',
          title: 'Deduce execution pathway',
          description: 'Planning actions to fulfill request',
          status: step1SubStatus,
          priority: 'high' as const,
          tools: ['action-planner'],
        },
      ],
    },
    {
      id: 'step-2',
      title: 'Governance policy evaluation',
      description: 'Subjecting request to server checks',
      status: 'queued' as TaskState,
      priority: 'high' as const,
      dependencies: ['step-1'],
      subtasks: [
        {
          id: 'step-2.1',
          title: 'Validate role credentials',
          description: 'Checking user credentials',
          status: 'queued' as TaskState,
          priority: 'high' as const,
          tools: ['clerk-auth', 'role-policy'],
        },
        {
          id: 'step-2.2',
          title: 'Check safety bounds',
          description: 'Ensuring actions remain within guidelines',
          status: 'queued' as TaskState,
          priority: 'high' as const,
          tools: ['date-validator', 'logical-constraint'],
        },
        {
          id: 'step-2.3',
          title: 'Assess privacy exposures',
          description: 'Scanning fields for potential risks',
          status: 'queued' as TaskState,
          priority: 'medium' as const,
          tools: ['privacy-risk-analyzer', 'security-risk-analyzer'],
        },
      ],
    },
    {
      id: 'step-3',
      title: 'Executing planned instructions',
      description: 'Applying safe state changes and syncs',
      status: 'queued' as TaskState,
      priority: 'high' as const,
      dependencies: ['step-2'],
      subtasks: [
        {
          id: 'step-3.1',
          title: 'Apply database/API updates',
          description: 'Executing approved operations',
          status: 'queued' as TaskState,
          priority: 'high' as const,
          tools: ['stream-video-client'],
        },
        {
          id: 'step-3.2',
          title: 'Propagate state synchronization',
          description: 'Updating frontend feed state',
          status: 'queued' as TaskState,
          priority: 'medium' as const,
          tools: ['calendar-context-writer'],
        },
      ],
    },
  ];
}

async function generateDynamicTasks(prompt: string, isCompleted: boolean = false) {
  // Directly use the local deterministic fallback task generator.
  // This bypasses the secondary LLM task generation call completely, saving 10-15 seconds of latency.
  return generateFallbackTasks(prompt, isCompleted);
}

async function classifyMode(userMessage: string): Promise<{ mode: 'chat' | 'deep_search' | 'automate'; confidence: number; reason: string }> {
  const lower = userMessage.toLowerCase();
  
  const automateKeywords = [
    'schedule', 'create', 'book', 'setup', 'set up', 'event', 'meeting', 
    'appointment', 'calendar', 'remind', 'reminder', 'todo', 'to-do', 
    'task', 'invite', 'call room', 'sync', 'cancel', 'delete', 'reschedule',
    'update', 'modify', 'change', 'host', 'session', 'plan'
  ];
  
  const searchKeywords = [
    'analyze', 'analysis', 'deep search', 'research', 'audit', 'investigate', 
    'investigation', 'explain', 'why', 'insights', 'compare', 'comparison', 
    'report', 'overview', 'details about'
  ];

  if (automateKeywords.some(keyword => lower.includes(keyword))) {
    return { mode: 'automate', confidence: 1.0, reason: 'Local keyword match (automate)' };
  }
  if (searchKeywords.some(keyword => lower.includes(keyword))) {
    return { mode: 'deep_search', confidence: 1.0, reason: 'Local keyword match (deep_search)' };
  }

  // Fast path: if it doesn't match automate or search keywords, it's almost certainly chat.
  // We can bypass classification entirely for standard conversational messages to speed up response time.
  return { mode: 'chat', confidence: 1.0, reason: 'Local bypass' };
}

export async function POST(req: Request) {
  try {
    const { messages, isThinking, userId, currentDateTime, mode } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();
    const dispatcher = new EventStreamDispatcher(writer);

    (async () => {
      try {
        const referenceDateTime = currentDateTime || new Date().toISOString();
        const userContextText = await getAIUserContext(userId);
        const systemPromptContent = `${systemPromptTemplate}

Strict Time Grounding:
- The user's current local date and time is: ${referenceDateTime}.
- You MUST use this exact date and time reference to resolve relative temporal terms such as "today", "tomorrow", "7:30 PM", "in 2 hours", etc.
- Always check that any meeting you plan is strictly in the future relative to this current date and time reference.

${userContextText}`;

        const systemMessage: OpenRouterMessage = {
          role: 'system',
          content: systemPromptContent,
        };

        const finalMessages = [systemMessage, ...messages];

        const lastUserMsg = messages[messages.length - 1]?.content || '';
        
        let effectiveMode: 'chat' | 'deep_search' | 'automate' = 'chat';
        let source: 'user' | 'classifier' = 'classifier';
        let confidence = 1.0;

        if (mode === 'think') {
          effectiveMode = 'automate';
          source = 'user';
        } else if (mode === 'search') {
          effectiveMode = 'deep_search';
          source = 'user';
        } else {
          // Classifier runs only if no manual mode was selected
          const result = await classifyMode(lastUserMsg);
          confidence = result.confidence;
          
          // Only auto-switch if confidence meets the threshold (e.g. 0.85)
          if (result.mode !== 'chat' && result.confidence >= 0.85) {
            effectiveMode = result.mode;
          } else {
            effectiveMode = 'chat';
          }
          source = 'classifier';
        }

        // Emit mode_selected event immediately so client switches UI right away!
        await dispatcher.send({
          schema_version: '1.0',
          timestamp: new Date().toISOString(),
          type: 'mode_selected',
          mode: effectiveMode,
          source,
          confidence,
        });

        let isAutomate = effectiveMode === 'automate';
        const effectiveThinking = isThinking || effectiveMode === 'deep_search';

        // Helper to reduce dispatch boilerplate
        const emit = (id: string, status: TaskState) =>
          dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'task_update',
            id,
            status,
          });

        // ─── STEP 0: For Automate mode, emit the plan IMMEDIATELY so the UI updates ───
        if (isAutomate) {
          const tasks = await generateDynamicTasks(lastUserMsg, false);

          await dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'plan_generated',
            tasks,
          });

          // Start Step 1: AI Request Processing
          await emit('step-1', 'running');
          await emit('step-1.1', 'running');
        }

        // ─── STEP 1: LLM Call (this is the slow part — plan is already visible) ───
        const responseText = await fetchOpenRouterCompletion(
          finalMessages,
          undefined,
          effectiveThinking
        );

        if (isAutomate) {
          await emit('step-1.1', 'succeeded');
          await emit('step-1.2', 'running');
        }

        // ─── Parse LLM response to detect structured action plans ───
        let isActionPlan = false;
        let parsedPlans: any[] = [];

        try {
          // Robust extraction: find all JSON blocks inside markdown fence blocks
          const jsonRegex = /```json\s*([\s\S]*?)\s*```|```\s*(\{[\s\S]*?\})\s*```/g;
          const matches = [...responseText.matchAll(jsonRegex)];
          
          if (matches.length > 0) {
            for (const m of matches) {
              const jsonText = (m[1] || m[2] || "").trim();
              try {
                const parsed = JSON.parse(jsonText);
                if (parsed && typeof parsed === 'object' && parsed.intent) {
                  parsedPlans.push(parsed);
                }
              } catch (err) {
                // Ignore invalid JSON inside code blocks
              }
            }
          } else {
            // Check if the entire response is a JSON object
            const trimmed = responseText.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object' && parsed.intent) {
                  parsedPlans.push(parsed);
                }
              } catch (err) {
                // Ignore
              }
            }
          }

          if (parsedPlans.length > 0) {
            isActionPlan = true;
          }
        } catch (e) {
          // Not structured JSON action plans — treat as plain text
        }

        if (isActionPlan && parsedPlans.length > 0 && !isAutomate) {
          // Upgrade to Automate mode on the fly!
          isAutomate = true;

          const tasks = await generateDynamicTasks(lastUserMsg, true);

          await dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'plan_generated',
            tasks,
          });
        }

        if (isAutomate) {
          await emit('step-1.2', 'succeeded');
          await emit('step-1', 'succeeded');
        }

        // ─── ACTION PLAN PATH (meeting scheduling, etc.) ───
        if (isActionPlan && parsedPlans.length > 0) {
          // Step 2: Governance Security Audit
          if (isAutomate) {
            await emit('step-2', 'running');
            await emit('step-2.1', 'running');
          }

          const approvedPlans: any[] = [];

          for (const parsedPlan of parsedPlans) {
            const policyResult = await checkPrivacyPolicy({
              userId: userId || 'unknown-user',
              action: parsedPlan.intent,
              payload: parsedPlan.entities,
            });

            if (!policyResult.allowed) {
              if (isAutomate) {
                await emit('step-2.1', 'failed');
                await emit('step-2.2', 'blocked');
                await emit('step-2.3', 'blocked');
                await emit('step-2', 'failed');
                await emit('step-3', 'blocked');
                await emit('step-3.1', 'blocked');
                await emit('step-3.2', 'blocked');
              }
              await dispatcher.send({
                schema_version: '1.0',
                timestamp: new Date().toISOString(),
                type: 'final_message',
                text: `Governance Policy Blocked Action:\n${policyResult.reason || 'Unauthorized operation.'}`,
              });
              return;
            }
          }

          if (isAutomate) {
            await emit('step-2.1', 'succeeded');
            await emit('step-2.2', 'running');
            await emit('step-2.3', 'running');
          }

          for (const parsedPlan of parsedPlans) {
            const plannerResult = ActionPlanner.planAction({
              intent: parsedPlan.intent,
              entities: parsedPlan.entities,
            });

            if (!plannerResult.success) {
              if (isAutomate) {
                await emit('step-2.2', 'failed');
                await emit('step-2.3', 'blocked');
                await emit('step-2', 'failed');
                await emit('step-3', 'blocked');
                await emit('step-3.1', 'blocked');
                await emit('step-3.2', 'blocked');
              }
              await dispatcher.send({
                schema_version: '1.0',
                timestamp: new Date().toISOString(),
                type: 'final_message',
                text: `Governance Audit Blocked Action:\n${plannerResult.error}`,
              });
              return;
            }

            approvedPlans.push(plannerResult.plan);
          }

          if (isAutomate) {
            await emit('step-2.2', 'succeeded');
            await emit('step-2.3', 'succeeded');
            await emit('step-2', 'succeeded');

            // Step 3: Execution Gateway
            await emit('step-3', 'running');
            await emit('step-3.1', 'running');
            await emit('step-3.2', 'running');
            await new Promise((resolve) => setTimeout(resolve, 400));
            await emit('step-3.1', 'succeeded');
            await emit('step-3.2', 'succeeded');
            await emit('step-3', 'succeeded');
          }

          const intents = parsedPlans.map(p => p.intent);
          const hasUpdate = intents.includes('updateMeeting');
          const actionVerb = hasUpdate ? 'Updating/Scheduling' : 'Scheduling';
          await dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'final_message',
            text: `Action approved by Governance Engine! ${actionVerb} meeting(s) now...`,
            actionPlan: approvedPlans[0],
            actionPlans: approvedPlans,
          });

        // ─── NON-ACTION PLAN PATH (regular text responses) ───
        } else {
          if (isAutomate) {
            // For non-action requests in Automate mode, quickly succeed remaining tasks
            await emit('step-2', 'running');
            await emit('step-2.1', 'running');
            await new Promise((resolve) => setTimeout(resolve, 200));
            await emit('step-2.1', 'succeeded');
            await emit('step-2.2', 'running');
            await emit('step-2.3', 'running');
            await new Promise((resolve) => setTimeout(resolve, 200));
            await emit('step-2.2', 'succeeded');
            await emit('step-2.3', 'succeeded');
            await emit('step-2', 'succeeded');

            await emit('step-3', 'running');
            await emit('step-3.1', 'running');
            await emit('step-3.2', 'running');
            await new Promise((resolve) => setTimeout(resolve, 200));
            await emit('step-3.1', 'succeeded');
            await emit('step-3.2', 'succeeded');
            await emit('step-3', 'succeeded');
          }

          await dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'final_message',
            text: responseText,
          });
        }
      } catch (err: any) {
        console.error('[Chat Stream Error inside execution IIFE]:', err);
        await dispatcher.send({
          schema_version: '1.0',
          timestamp: new Date().toISOString(),
          type: 'error_message',
          error: {
            code: 'STREAM_EXECUTION_FAILURE',
            message: err.message || 'Error executing stream context'
          }
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[Chat API Route Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
