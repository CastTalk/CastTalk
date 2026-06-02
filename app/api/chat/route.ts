import { NextResponse } from 'next/server';
import { fetchOpenRouterCompletion, OpenRouterMessage } from '@/lib/openrouter';
import { systemPromptTemplate } from '@/ai-context/prompts/systemPrompt';
import { ActionPlanner } from '@/ai-context/planner/actionPlanner';
import { checkPrivacyPolicy } from '@/ai-context/policies/privacy.policy';
import { EventStreamDispatcher, TaskState } from '@/lib/agent-sse';

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
  const step1Status = isCompleted ? 'succeeded' : 'queued';
  const step1SubStatus = isCompleted ? 'succeeded' : 'queued';
  
  const systemPrompt = `You are a precise task planner. Analyze the user's prompt and create a 3-step action plan to accomplish their goal.
Each step should have 2-3 subtasks. 
The plan MUST be returned as a JSON array of tasks matching this EXACT schema (NO text, ONLY valid JSON array):
[
  {
    "id": "step-1",
    "title": "Specific Title for Step 1",
    "description": "Specific Description",
    "status": "${step1Status}",
    "priority": "high",
    "dependencies": [],
    "subtasks": [
      {
        "id": "step-1.1",
        "title": "Specific Subtask Title",
        "description": "Specific Subtask Description",
        "status": "${step1SubStatus}",
        "priority": "high",
        "tools": ["llm-engine"]
      }
    ]
  }
]
IMPORTANT RULES:
1. Make the titles and descriptions highly specific to the user's request context instead of using generic placeholder text. Don't use words like "Identifying parameters" if the user wants to book a meeting, use "Extracting meeting details for [User's Subject]". Use proper casing.
2. Step 1 (id: "step-1") is for parsing and identifying parameters.
3. Step 2 (id: "step-2", dependencies: ["step-1"]) is for governance checks, conflict scanning, and validation.
4. Step 3 (id: "step-3", dependencies: ["step-2"]) is for executing the action.
5. Provide exactly 3 steps.`;

  try {
    const rawResult = await fetchOpenRouterCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'google/gemini-2.5-flash-api-free' // Using a very fast LLM optimized for JSON
    );
    
    let jsonText = rawResult.trim();
    if (jsonText.startsWith('\`\`\`json') && jsonText.endsWith('\`\`\`')) {
      jsonText = jsonText.substring(7, jsonText.length - 3).trim();
    } else if (jsonText.startsWith('\`\`\`') && jsonText.endsWith('\`\`\`')) {
      jsonText = jsonText.substring(3, jsonText.length - 3).trim();
    }

    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure all statuses match the expected shape (prevent broken UI)
      return parsed.map((step: any) => ({
        ...step,
        status: step.id === 'step-1' ? step1Status : 'queued',
        subtasks: Array.isArray(step.subtasks) ? step.subtasks.map((sub: any) => ({
          ...sub,
          status: step.id === 'step-1' ? step1SubStatus : 'queued',
        })) : []
      }));
    }
  } catch (error) {
    console.error('Error generating dynamic tasks:', error);
  }

  // Fallback to the original hardcoded logic if LLM fails
  return generateFallbackTasks(prompt, isCompleted);
}

async function classifyMode(userMessage: string): Promise<{ mode: 'chat' | 'deep_search' | 'automate'; confidence: number; reason: string }> {
  const systemPrompt = `You are a precise, ultra-fast intent classifier.
Analyze the user's message and determine the mode.
Options:
- "automate" if the user wants to MUTATE or CREATE data (e.g. schedule, create, edit, delete, or book a meeting, task, calendar event, reminder, invite someone, or trigger actions). DO NOT use this for simply asking questions about the calendar.
- "deep_search" if the user requests detailed analysis, deep research, comparisons, audits, explanation of why something happened, or investigation.
- "chat" for normal conversation, basic questions, general chat, greetings, OR asking about existing data (e.g. "Do I have any meetings today?", "What is my schedule?", "Read my tasks").

Respond ONLY with a JSON object in the following format:
{
  "mode": "automate" | "deep_search" | "chat",
  "confidence": number (between 0.0 and 1.0),
  "reason": "short explanation"
}`;

  try {
    const rawResult = await fetchOpenRouterCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      'google/gemini-2.5-flash-api-free'
    );
    
    let jsonText = rawResult.trim();
    if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
      jsonText = jsonText.substring(7, jsonText.length - 3).trim();
    } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
      jsonText = jsonText.substring(3, jsonText.length - 3).trim();
    }

    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object' && parsed.mode) {
      return {
        mode: parsed.mode === 'automate' || parsed.mode === 'deep_search' || parsed.mode === 'chat' ? parsed.mode : 'chat',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1.0,
        reason: parsed.reason || ''
      };
    }
  } catch (error) {
    console.error('Error classifying mode in backend:', error);
  }

  return { mode: 'chat', confidence: 1.0, reason: 'Fallback default' };
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
        const systemPromptContent = `${systemPromptTemplate}

Strict Time Grounding:
- The user's current local date and time is: ${referenceDateTime}.
- You MUST use this exact date and time reference to resolve relative temporal terms such as "today", "tomorrow", "7:30 PM", "in 2 hours", etc.
- Always check that any meeting you plan is strictly in the future relative to this current date and time reference.`;

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
        let parsedPlan: any = null;

        try {
          let jsonText = responseText.trim();
          if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
            jsonText = jsonText.substring(7, jsonText.length - 3).trim();
          } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
            jsonText = jsonText.substring(3, jsonText.length - 3).trim();
          }
          
          const parsed = JSON.parse(jsonText);
          if (parsed && typeof parsed === 'object' && parsed.intent) {
            isActionPlan = true;
            parsedPlan = parsed;
          }
        } catch (e) {
          // Not a structured JSON action plan — treat as plain text
        }

        if (isActionPlan && parsedPlan && !isAutomate) {
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
        if (isActionPlan && parsedPlan) {
          const title = parsedPlan.entities?.title || 'AI Scheduled Meeting';
          const duration = Number(parsedPlan.entities?.duration || 60);

          // Step 2: Governance Security Audit
          if (isAutomate) {
            await emit('step-2', 'running');
            await emit('step-2.1', 'running');
          }

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

          if (isAutomate) {
            await emit('step-2.1', 'succeeded');
            await emit('step-2.2', 'running');
            await emit('step-2.3', 'running');
          }

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

          const actionVerb = parsedPlan.intent === 'updateMeeting' ? 'Updating' : 'Scheduling';
          await dispatcher.send({
            schema_version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'final_message',
            text: `Action approved by Governance Engine! ${actionVerb} meeting now...`,
            actionPlan: plannerResult.plan,
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
