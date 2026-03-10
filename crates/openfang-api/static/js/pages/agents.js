// OpenFang Agents Page — Multi-step spawn wizard, detail view with tabs, file editor, personality presets
'use strict';

function agentsPage() {
  return {
    tab: 'agents',
    activeChatAgent: null,
    // -- Agents state --
    showSpawnModal: false,
    showDetailModal: false,
    detailAgent: null,
    spawnMode: 'wizard',
    spawning: false,
    spawnToml: '',
    filterState: 'all',
    loading: true,
    loadError: '',
    spawnForm: {
      name: '',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'You are a helpful assistant.',
      profile: 'full',
      caps: { memory_read: true, memory_write: true, network: false, shell: false, agent_spawn: false }
    },

    // -- Multi-step wizard state --
    spawnStep: 1,
    spawnIdentity: { emoji: '', color: '#FF5C00', archetype: '' },
    selectedPreset: '',
    soulContent: '',
    emojiOptions: [
      '\u{1F916}', '\u{1F4BB}', '\u{1F50D}', '\u{270D}\uFE0F', '\u{1F4CA}', '\u{1F6E0}\uFE0F',
      '\u{1F4AC}', '\u{1F393}', '\u{1F310}', '\u{1F512}', '\u{26A1}', '\u{1F680}',
      '\u{1F9EA}', '\u{1F3AF}', '\u{1F4D6}', '\u{1F9D1}\u200D\u{1F4BB}', '\u{1F4E7}', '\u{1F3E2}',
      '\u{2764}\uFE0F', '\u{1F31F}', '\u{1F527}', '\u{1F4DD}', '\u{1F4A1}', '\u{1F3A8}'
    ],
    archetypeOptions: ['Assistant', 'Researcher', 'Coder', 'Writer', 'DevOps', 'Support', 'Analyst', 'Custom'],
    personalityPresets: [
      { id: 'professional', label: 'Professional', soul: 'Communicate in a clear, professional tone. Be direct and structured. Use formal language and data-driven reasoning. Prioritize accuracy over personality.' },
      { id: 'friendly', label: 'Friendly', soul: 'Be warm, approachable, and conversational. Use casual language and show genuine interest in the user. Add personality to your responses while staying helpful.' },
      { id: 'technical', label: 'Technical', soul: 'Focus on technical accuracy and depth. Use precise terminology. Show your work and reasoning. Prefer code examples and structured explanations.' },
      { id: 'creative', label: 'Creative', soul: 'Be imaginative and expressive. Use vivid language, analogies, and unexpected connections. Encourage creative thinking and explore multiple perspectives.' },
      { id: 'concise', label: 'Concise', soul: 'Be extremely brief and to the point. No filler, no pleasantries. Answer in the fewest words possible while remaining accurate and complete.' },
      { id: 'mentor', label: 'Mentor', soul: 'Be patient and encouraging like a great teacher. Break down complex topics step by step. Ask guiding questions. Celebrate progress and build confidence.' }
    ],

    // -- Detail modal tabs --
    detailTab: 'info',
    agentFiles: [],
    editingFile: null,
    fileContent: '',
    fileSaving: false,
    filesLoading: false,
    configForm: {},
    configSaving: false,
    // -- Tool filters --
    toolFilters: { tool_allowlist: [], tool_blocklist: [] },
    toolFiltersLoading: false,
    newAllowTool: '',
    newBlockTool: '',
    // -- Model switch --
    editingModel: false,
    newModelValue: '',
    modelSaving: false,
    // -- Fallback chain --
    editingFallback: false,
    newFallbackValue: '',

    // -- Templates state --
    tplTemplates: [],
    tplProviders: [],
    tplLoading: false,
    tplLoadError: '',
    selectedCategory: 'All',
    searchQuery: '',

    builtinTemplates: [
      // ── General ──────────────────────────────────────────────────────
      {
        name: 'General Assistant',
        description: 'A versatile conversational agent that can help with everyday tasks, answer questions, and provide recommendations.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are a helpful, friendly assistant. Provide clear, accurate, and concise responses. Ask clarifying questions when needed.'
      },
      {
        name: 'Hello World',
        description: 'A friendly greeting agent that can read files, search the web, and answer everyday questions.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a warm, helpful first-contact agent. Be concise and friendly. Use web search to answer factual questions with current, accurate information.'
      },
      {
        name: 'Tutor',
        description: 'A patient educational agent that explains concepts step-by-step and adapts to the learner\'s level.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are a patient and encouraging tutor. Explain concepts step by step, starting from fundamentals. Use analogies and examples. Check understanding before moving on. Adapt to the learner\'s pace.'
      },
      {
        name: 'Translator',
        description: 'Multi-language translation agent for document translation, localization, and cross-cultural communication.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'minimal',
        system_prompt: 'You are a multilingual translator. Provide accurate, natural translations across major world languages, preserving tone, intent, and cultural nuances.'
      },
      {
        name: 'Travel Planner',
        description: 'Trip planning agent for itinerary creation, booking research, budget estimation, and travel logistics.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a travel planner. Create detailed day-by-day itineraries, research accommodations and activities, estimate budgets, and optimize logistics to minimize backtracking.'
      },
      {
        name: 'Health Tracker',
        description: 'Wellness tracking agent for health metrics, medication reminders, fitness goals, and lifestyle habits.',
        category: 'General',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'minimal',
        system_prompt: 'You are a wellness assistant. Help log and analyze health metrics, track fitness goals, identify trends, and provide actionable lifestyle insights.'
      },
      // ── Development ──────────────────────────────────────────────────
      {
        name: 'Coder',
        description: 'Expert software engineer. Reads, writes, and analyzes code across multiple languages.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are an expert software engineer. Read existing code before making changes. Write clean, production-quality code following project conventions. Handle errors properly.'
      },
      {
        name: 'Architect',
        description: 'System architect. Designs software architectures, evaluates trade-offs, creates technical specifications.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are a system architect. Design clean, scalable architectures with clear boundaries. Evaluate trade-offs explicitly. Prioritize simplicity and explicit over implicit design.'
      },
      {
        name: 'Code Reviewer',
        description: 'Senior code reviewer. Reviews PRs, identifies issues, suggests improvements with production standards.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are a senior code reviewer. Evaluate code for correctness, security, performance, and maintainability — in that priority order. Provide specific, actionable feedback with examples.'
      },
      {
        name: 'Debugger',
        description: 'Expert debugger. Traces bugs, analyzes stack traces, performs root cause analysis.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are an expert debugger. Reproduce the issue, isolate the root cause, and propose the minimal correct fix. Never guess — trace the actual code path using files and logs.'
      },
      {
        name: 'Data Analyst',
        description: 'Data analyst. Processes data, generates insights, creates reports and visualizations.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are a data analyst. Clarify the question, explore and analyze the data, produce visualizations and tables, and deliver structured reports with actionable insights.'
      },
      {
        name: 'Data Scientist',
        description: 'Data scientist. Analyzes datasets, builds models, creates visualizations, performs statistical analysis.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are a data scientist. Explore data distributions, apply appropriate statistical methods, build predictive models, and communicate findings clearly with reproducible code.'
      },
      {
        name: 'Test Engineer',
        description: 'Quality assurance engineer. Designs test strategies, writes tests, validates correctness.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are a QA engineer. Design comprehensive test strategies and write unit, integration, and e2e tests. Tests should document behavior, not implementation, and fail for exactly one reason.'
      },
      {
        name: 'Security Auditor',
        description: 'Security specialist. Reviews code for vulnerabilities, checks configurations, performs threat modeling.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are a security auditor. Review code for OWASP Top 10 vulnerabilities, audit configurations, perform threat modeling, and provide concrete remediation recommendations.'
      },
      {
        name: 'Ops Engineer',
        description: 'DevOps agent. Monitors systems, runs diagnostics, manages deployments.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'automation',
        system_prompt: 'You are a DevOps/SRE engineer. Observe before acting — check configs, logs, and status first. Diagnose issues systematically, plan changes explicitly, then execute incrementally.'
      },
      {
        name: 'DevOps Lead',
        description: 'DevOps lead. Manages CI/CD, infrastructure, deployments, monitoring, and incident response.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'automation',
        system_prompt: 'You are a DevOps lead. Manage CI/CD pipelines, Docker, Kubernetes, and infrastructure as code. Prioritize reliability, security, and observability in every decision.'
      },
      {
        name: 'Orchestrator',
        description: 'Meta-agent that decomposes complex tasks, delegates to specialist agents, and synthesizes results.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'automation',
        system_prompt: 'You are a meta-agent orchestrator. Decompose complex tasks into subtasks, delegate to specialist agents via agent_send, and synthesize all results into a coherent final answer.'
      },
      {
        name: 'API Designer',
        description: 'An agent specialized in RESTful API design, OpenAPI specs, and integration architecture.',
        category: 'Development',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'coding',
        system_prompt: 'You are an API design expert. Help users design clean, consistent RESTful APIs following best practices. Cover endpoint naming, request/response schemas, error handling, and versioning.'
      },
      // ── Writing ──────────────────────────────────────────────────────
      {
        name: 'Writer',
        description: 'Content writer. Creates documentation, articles, blog posts, and technical writing.',
        category: 'Writing',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are a skilled writer and editor. Help users create polished content. Adapt your tone and style to the intended audience. Offer constructive suggestions for improvement.'
      },
      {
        name: 'Doc Writer',
        description: 'Technical writer. Creates documentation, README files, API docs, tutorials, and architecture guides.',
        category: 'Writing',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a technical writer. Write for the reader — start with WHY, then WHAT, then HOW. Use progressive disclosure and always include working code examples.'
      },
      {
        name: 'Social Media',
        description: 'Social media content creation, scheduling, and engagement strategy agent.',
        category: 'Writing',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a social media strategist. Create platform-optimized content for Twitter/X, LinkedIn, Instagram, and more. Write hooks that stop the scroll and CTAs that drive engagement.'
      },
      // ── Research ─────────────────────────────────────────────────────
      {
        name: 'Researcher',
        description: 'Research agent. Fetches web content, cross-references sources, and synthesizes information.',
        category: 'Research',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a research analyst. Decompose questions, search multiple sources, cross-reference findings, and synthesize into a structured report with citations and confidence levels.'
      },
      // ── Business ─────────────────────────────────────────────────────
      {
        name: 'Customer Support',
        description: 'Customer support agent for ticket handling, issue resolution, and customer communication.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'messaging',
        system_prompt: 'You are a professional customer support representative. Be empathetic, patient, and solution-oriented. Acknowledge concerns before offering solutions. Escalate complex issues appropriately.'
      },
      {
        name: 'Email Assistant',
        description: 'Email triage, drafting, scheduling, and inbox management agent.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'messaging',
        system_prompt: 'You are an email assistant. Triage incoming email by urgency and category, draft professional responses, extract action items, and maintain clear, concise communication.'
      },
      {
        name: 'Meeting Assistant',
        description: 'Meeting notes, action items, agenda preparation, and follow-up tracking agent.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'minimal',
        system_prompt: 'You are a meeting assistant. Summarize transcripts into structured notes with key decisions, action items (with owners), discussion highlights, and follow-up questions.'
      },
      {
        name: 'Planner',
        description: 'Project planner. Creates project plans, breaks down epics, estimates effort, identifies risks.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are a project planner. Scope work, break epics into tasks, identify dependencies and critical path, estimate effort, and flag risks before they become blockers.'
      },
      {
        name: 'Recruiter',
        description: 'Recruiting agent for resume screening, candidate outreach, job description writing, and pipeline management.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'messaging',
        system_prompt: 'You are a recruiting assistant. Screen resumes against requirements, draft personalized outreach, write compelling job descriptions, and manage hiring pipeline stages.'
      },
      {
        name: 'Sales Assistant',
        description: 'Sales assistant agent for CRM updates, outreach drafting, pipeline management, and deal tracking.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'messaging',
        system_prompt: 'You are a sales assistant. Draft personalized outreach sequences, track pipeline stages, handle objections, and provide deal coaching based on the prospect\'s context.'
      },
      {
        name: 'Legal Assistant',
        description: 'Legal assistant agent for contract review, legal research, compliance checking, and document drafting.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'research',
        system_prompt: 'You are a legal assistant. Review contracts, flag unusual clauses, research legal topics, and check compliance. Always note that this is informational, not legal advice.'
      },
      {
        name: 'Personal Finance',
        description: 'Personal finance agent for budget tracking, expense analysis, savings goals, and financial planning.',
        category: 'Business',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'minimal',
        system_prompt: 'You are a personal finance advisor. Help create budgets, analyze spending patterns, track savings goals, and provide actionable financial guidance.'
      },
      // ── Automation ───────────────────────────────────────────────────
      {
        name: 'Home Automation',
        description: 'Smart home control agent for IoT device management, automation rules, and home monitoring.',
        category: 'Automation',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'automation',
        system_prompt: 'You are a smart home assistant. Help manage IoT devices, create automation rules, troubleshoot connectivity issues, and monitor home systems across all platforms.'
      },
      // ── OpenFang ─────────────────────────────────────────────────────
      {
        name: 'OpenFang Expert',
        description: 'Expert spécialisé sur OpenFang — aide les utilisateurs et les développeurs sur tous les aspects du projet.',
        category: 'OpenFang',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        profile: 'full',
        system_prompt: 'You are an OpenFang expert. Help users install, configure, and use OpenFang, and help developers understand the architecture, API, and how to contribute to the codebase.'
      }
    ],

    // ── Profile Descriptions ──
    profileDescriptions: {
      minimal: { label: 'Minimal', desc: 'Read-only file access' },
      coding: { label: 'Coding', desc: 'Files + shell + web fetch' },
      research: { label: 'Research', desc: 'Web search + file read/write' },
      messaging: { label: 'Messaging', desc: 'Agents + memory access' },
      automation: { label: 'Automation', desc: 'All tools except custom' },
      balanced: { label: 'Balanced', desc: 'General-purpose tool set' },
      precise: { label: 'Precise', desc: 'Focused tool set for accuracy' },
      creative: { label: 'Creative', desc: 'Full tools with creative emphasis' },
      full: { label: 'Full', desc: 'All 35+ tools' }
    },
    profileInfo: function(name) {
      return this.profileDescriptions[name] || { label: name, desc: '' };
    },

    // ── Tool Preview in Spawn Modal ──
    spawnProfiles: [],
    spawnProfilesLoaded: false,
    async loadSpawnProfiles() {
      if (this.spawnProfilesLoaded) return;
      try {
        var data = await OpenFangAPI.get('/api/profiles');
        this.spawnProfiles = data.profiles || [];
        this.spawnProfilesLoaded = true;
      } catch(e) { this.spawnProfiles = []; }
    },
    get selectedProfileTools() {
      var pname = this.spawnForm.profile;
      var match = this.spawnProfiles.find(function(p) { return p.name === pname; });
      if (match && match.tools) return match.tools.slice(0, 15);
      return [];
    },

    get agents() { return Alpine.store('app').agents; },

    get filteredAgents() {
      var f = this.filterState;
      if (f === 'all') return this.agents;
      return this.agents.filter(function(a) { return a.state.toLowerCase() === f; });
    },

    get runningCount() {
      return this.agents.filter(function(a) { return a.state === 'Running'; }).length;
    },

    get stoppedCount() {
      return this.agents.filter(function(a) { return a.state !== 'Running'; }).length;
    },

    // -- Templates computed --
    get categories() {
      var cats = { 'All': true };
      this.builtinTemplates.forEach(function(t) { cats[t.category] = true; });
      this.tplTemplates.forEach(function(t) { if (t.category) cats[t.category] = true; });
      return Object.keys(cats);
    },

    get filteredBuiltins() {
      var self = this;
      return this.builtinTemplates.filter(function(t) {
        if (self.selectedCategory !== 'All' && t.category !== self.selectedCategory) return false;
        if (self.searchQuery) {
          var q = self.searchQuery.toLowerCase();
          if (t.name.toLowerCase().indexOf(q) === -1 &&
              t.description.toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
      });
    },

    get filteredCustom() {
      var self = this;
      return this.tplTemplates.filter(function(t) {
        if (self.searchQuery) {
          var q = self.searchQuery.toLowerCase();
          if ((t.name || '').toLowerCase().indexOf(q) === -1 &&
              (t.description || '').toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
      });
    },

    isProviderConfigured(providerName) {
      if (!providerName) return false;
      var p = this.tplProviders.find(function(pr) { return pr.id === providerName; });
      return p ? p.auth_status === 'configured' : false;
    },

    async init() {
      var self = this;
      this.loading = true;
      this.loadError = '';
      try {
        await Alpine.store('app').refreshAgents();
      } catch(e) {
        this.loadError = e.message || 'Could not load agents. Is the daemon running?';
      }
      this.loading = false;

      // If a pending agent was set (e.g. from wizard or redirect), open chat inline
      var store = Alpine.store('app');
      if (store.pendingAgent) {
        this.activeChatAgent = store.pendingAgent;
      }
      // Watch for future pendingAgent changes
      this.$watch('$store.app.pendingAgent', function(agent) {
        if (agent) {
          self.activeChatAgent = agent;
        }
      });
    },

    async loadData() {
      this.loading = true;
      this.loadError = '';
      try {
        await Alpine.store('app').refreshAgents();
      } catch(e) {
        this.loadError = e.message || 'Could not load agents.';
      }
      this.loading = false;
    },

    async loadTemplates() {
      this.tplLoading = true;
      this.tplLoadError = '';
      try {
        var results = await Promise.all([
          OpenFangAPI.get('/api/templates'),
          OpenFangAPI.get('/api/providers').catch(function() { return { providers: [] }; })
        ]);
        this.tplTemplates = results[0].templates || [];
        this.tplProviders = results[1].providers || [];
      } catch(e) {
        this.tplTemplates = [];
        this.tplLoadError = e.message || 'Could not load templates.';
      }
      this.tplLoading = false;
    },

    chatWithAgent(agent) {
      Alpine.store('app').pendingAgent = agent;
      this.activeChatAgent = agent;
    },

    closeChat() {
      this.activeChatAgent = null;
      OpenFangAPI.wsDisconnect();
    },

    async showDetail(agent) {
      this.detailAgent = agent;
      this.detailAgent._fallbacks = [];
      this.detailTab = 'info';
      this.agentFiles = [];
      this.editingFile = null;
      this.fileContent = '';
      this.editingFallback = false;
      this.newFallbackValue = '';
      this.configForm = {
        name: agent.name || '',
        system_prompt: agent.system_prompt || '',
        emoji: (agent.identity && agent.identity.emoji) || '',
        color: (agent.identity && agent.identity.color) || '#FF5C00',
        archetype: (agent.identity && agent.identity.archetype) || '',
        vibe: (agent.identity && agent.identity.vibe) || ''
      };
      this.showDetailModal = true;
      // Fetch full agent detail to get fallback_models
      try {
        var full = await OpenFangAPI.get('/api/agents/' + agent.id);
        this.detailAgent._fallbacks = full.fallback_models || [];
      } catch(e) { /* ignore */ }
    },

    killAgent(agent) {
      var self = this;
      OpenFangToast.confirm('Stop Agent', 'Stop agent "' + agent.name + '"? The agent will be shut down.', async function() {
        try {
          await OpenFangAPI.del('/api/agents/' + agent.id);
          OpenFangToast.success('Agent "' + agent.name + '" stopped');
          self.showDetailModal = false;
          await Alpine.store('app').refreshAgents();
        } catch(e) {
          OpenFangToast.error('Failed to stop agent: ' + e.message);
        }
      });
    },

    killAllAgents() {
      var list = this.filteredAgents;
      if (!list.length) return;
      OpenFangToast.confirm('Stop All Agents', 'Stop ' + list.length + ' agent(s)? All agents will be shut down.', async function() {
        var errors = [];
        for (var i = 0; i < list.length; i++) {
          try {
            await OpenFangAPI.del('/api/agents/' + list[i].id);
          } catch(e) { errors.push(list[i].name + ': ' + e.message); }
        }
        await Alpine.store('app').refreshAgents();
        if (errors.length) {
          OpenFangToast.error('Some agents failed to stop: ' + errors.join(', '));
        } else {
          OpenFangToast.success(list.length + ' agent(s) stopped');
        }
      });
    },

    // ── Multi-step wizard navigation ──
    openSpawnWizard() {
      this.showSpawnModal = true;
      this.spawnStep = 1;
      this.spawnMode = 'wizard';
      this.spawnIdentity = { emoji: '', color: '#FF5C00', archetype: '' };
      this.selectedPreset = '';
      this.soulContent = '';
      this.spawnForm.name = '';
      this.spawnForm.systemPrompt = 'You are a helpful assistant.';
      this.spawnForm.profile = 'full';
    },

    nextStep() {
      if (this.spawnStep === 1 && !this.spawnForm.name.trim()) {
        OpenFangToast.warn('Please enter an agent name');
        return;
      }
      if (this.spawnStep < 5) this.spawnStep++;
    },

    prevStep() {
      if (this.spawnStep > 1) this.spawnStep--;
    },

    selectPreset(preset) {
      this.selectedPreset = preset.id;
      this.soulContent = preset.soul;
    },

    generateToml() {
      var f = this.spawnForm;
      var si = this.spawnIdentity;
      var lines = [
        'name = "' + f.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"',
        'module = "builtin:chat"'
      ];
      if (f.profile && f.profile !== 'custom') {
        lines.push('profile = "' + f.profile + '"');
      }
      lines.push('', '[model]');
      lines.push('provider = "' + f.provider + '"');
      lines.push('model = "' + f.model + '"');
      lines.push('system_prompt = """\n' + f.systemPrompt.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"') + '\n"""');
      if (f.profile === 'custom') {
        lines.push('', '[capabilities]');
        if (f.caps.memory_read) lines.push('memory_read = ["*"]');
        if (f.caps.memory_write) lines.push('memory_write = ["self.*"]');
        if (f.caps.network) lines.push('network = ["*"]');
        if (f.caps.shell) lines.push('shell = ["*"]');
        if (f.caps.agent_spawn) lines.push('agent_spawn = true');
      }
      return lines.join('\n');
    },

    async setMode(agent, mode) {
      try {
        await OpenFangAPI.put('/api/agents/' + agent.id + '/mode', { mode: mode });
        agent.mode = mode;
        OpenFangToast.success('Mode set to ' + mode);
        await Alpine.store('app').refreshAgents();
      } catch(e) {
        OpenFangToast.error('Failed to set mode: ' + e.message);
      }
    },

    async spawnAgent() {
      this.spawning = true;
      var toml = this.spawnMode === 'wizard' ? this.generateToml() : this.spawnToml;
      if (!toml.trim()) {
        this.spawning = false;
        OpenFangToast.warn('Manifest is empty \u2014 enter agent config first');
        return;
      }

      try {
        var res = await OpenFangAPI.post('/api/agents', { manifest_toml: toml });
        if (res.agent_id) {
          // Post-spawn: update identity + write SOUL.md if personality preset selected
          var patchBody = {};
          if (this.spawnIdentity.emoji) patchBody.emoji = this.spawnIdentity.emoji;
          if (this.spawnIdentity.color) patchBody.color = this.spawnIdentity.color;
          if (this.spawnIdentity.archetype) patchBody.archetype = this.spawnIdentity.archetype;
          if (this.selectedPreset) patchBody.vibe = this.selectedPreset;

          if (Object.keys(patchBody).length) {
            OpenFangAPI.patch('/api/agents/' + res.agent_id + '/config', patchBody).catch(function(e) { console.warn('Post-spawn config patch failed:', e.message); });
          }
          if (this.soulContent.trim()) {
            OpenFangAPI.put('/api/agents/' + res.agent_id + '/files/SOUL.md', { content: '# Soul\n' + this.soulContent }).catch(function(e) { console.warn('SOUL.md write failed:', e.message); });
          }

          this.showSpawnModal = false;
          this.spawnForm.name = '';
          this.spawnToml = '';
          this.spawnStep = 1;
          OpenFangToast.success('Agent "' + (res.name || 'new') + '" spawned');
          await Alpine.store('app').refreshAgents();
          this.chatWithAgent({ id: res.agent_id, name: res.name, model_provider: '?', model_name: '?' });
        } else {
          OpenFangToast.error('Spawn failed: ' + (res.error || 'Unknown error'));
        }
      } catch(e) {
        OpenFangToast.error('Failed to spawn agent: ' + e.message);
      }
      this.spawning = false;
    },

    // ── Detail modal: Files tab ──
    async loadAgentFiles() {
      if (!this.detailAgent) return;
      this.filesLoading = true;
      try {
        var data = await OpenFangAPI.get('/api/agents/' + this.detailAgent.id + '/files');
        this.agentFiles = data.files || [];
      } catch(e) {
        this.agentFiles = [];
        OpenFangToast.error('Failed to load files: ' + e.message);
      }
      this.filesLoading = false;
    },

    async openFile(file) {
      if (!file.exists) {
        // Create with empty content
        this.editingFile = file.name;
        this.fileContent = '';
        return;
      }
      try {
        var data = await OpenFangAPI.get('/api/agents/' + this.detailAgent.id + '/files/' + encodeURIComponent(file.name));
        this.editingFile = file.name;
        this.fileContent = data.content || '';
      } catch(e) {
        OpenFangToast.error('Failed to read file: ' + e.message);
      }
    },

    async saveFile() {
      if (!this.editingFile || !this.detailAgent) return;
      this.fileSaving = true;
      try {
        await OpenFangAPI.put('/api/agents/' + this.detailAgent.id + '/files/' + encodeURIComponent(this.editingFile), { content: this.fileContent });
        OpenFangToast.success(this.editingFile + ' saved');
        await this.loadAgentFiles();
      } catch(e) {
        OpenFangToast.error('Failed to save file: ' + e.message);
      }
      this.fileSaving = false;
    },

    closeFileEditor() {
      this.editingFile = null;
      this.fileContent = '';
    },

    // ── Detail modal: Config tab ──
    async saveConfig() {
      if (!this.detailAgent) return;
      this.configSaving = true;
      try {
        await OpenFangAPI.patch('/api/agents/' + this.detailAgent.id + '/config', this.configForm);
        OpenFangToast.success('Config updated');
        await Alpine.store('app').refreshAgents();
      } catch(e) {
        OpenFangToast.error('Failed to save config: ' + e.message);
      }
      this.configSaving = false;
    },

    // ── Clone agent ──
    async cloneAgent(agent) {
      var newName = (agent.name || 'agent') + '-copy';
      try {
        var res = await OpenFangAPI.post('/api/agents/' + agent.id + '/clone', { new_name: newName });
        if (res.agent_id) {
          OpenFangToast.success('Cloned as "' + res.name + '"');
          await Alpine.store('app').refreshAgents();
          this.showDetailModal = false;
        }
      } catch(e) {
        OpenFangToast.error('Clone failed: ' + e.message);
      }
    },

    // -- Template methods --
    async spawnFromTemplate(name) {
      try {
        var data = await OpenFangAPI.get('/api/templates/' + encodeURIComponent(name));
        if (data.manifest_toml) {
          var res = await OpenFangAPI.post('/api/agents', { manifest_toml: data.manifest_toml });
          if (res.agent_id) {
            OpenFangToast.success('Agent "' + (res.name || name) + '" spawned from template');
            await Alpine.store('app').refreshAgents();
            this.chatWithAgent({ id: res.agent_id, name: res.name || name, model_provider: '?', model_name: '?' });
          }
        }
      } catch(e) {
        OpenFangToast.error('Failed to spawn from template: ' + e.message);
      }
    },

    // ── Clear agent history ──
    async clearHistory(agent) {
      var self = this;
      OpenFangToast.confirm('Clear History', 'Clear all conversation history for "' + agent.name + '"? This cannot be undone.', async function() {
        try {
          await OpenFangAPI.del('/api/agents/' + agent.id + '/history');
          OpenFangToast.success('History cleared for "' + agent.name + '"');
        } catch(e) {
          OpenFangToast.error('Failed to clear history: ' + e.message);
        }
      });
    },

    // ── Model switch ──
    async changeModel() {
      if (!this.detailAgent || !this.newModelValue.trim()) return;
      this.modelSaving = true;
      try {
        var resp = await OpenFangAPI.put('/api/agents/' + this.detailAgent.id + '/model', { model: this.newModelValue.trim() });
        var providerInfo = (resp && resp.provider) ? ' (provider: ' + resp.provider + ')' : '';
        OpenFangToast.success('Model changed' + providerInfo + ' (memory reset)');
        this.editingModel = false;
        await Alpine.store('app').refreshAgents();
        // Refresh detailAgent
        var agents = Alpine.store('app').agents;
        for (var i = 0; i < agents.length; i++) {
          if (agents[i].id === this.detailAgent.id) { this.detailAgent = agents[i]; break; }
        }
      } catch(e) {
        OpenFangToast.error('Failed to change model: ' + e.message);
      }
      this.modelSaving = false;
    },

    // ── Fallback model chain ──
    async addFallback() {
      if (!this.detailAgent || !this.newFallbackValue.trim()) return;
      var parts = this.newFallbackValue.trim().split('/');
      var provider = parts.length > 1 ? parts[0] : this.detailAgent.model_provider;
      var model = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
      if (!this.detailAgent._fallbacks) this.detailAgent._fallbacks = [];
      this.detailAgent._fallbacks.push({ provider: provider, model: model });
      try {
        await OpenFangAPI.patch('/api/agents/' + this.detailAgent.id + '/config', {
          fallback_models: this.detailAgent._fallbacks
        });
        OpenFangToast.success('Fallback added: ' + provider + '/' + model);
      } catch(e) {
        OpenFangToast.error('Failed to save fallbacks: ' + e.message);
        this.detailAgent._fallbacks.pop();
      }
      this.editingFallback = false;
      this.newFallbackValue = '';
    },

    async removeFallback(idx) {
      if (!this.detailAgent || !this.detailAgent._fallbacks) return;
      var removed = this.detailAgent._fallbacks.splice(idx, 1);
      try {
        await OpenFangAPI.patch('/api/agents/' + this.detailAgent.id + '/config', {
          fallback_models: this.detailAgent._fallbacks
        });
        OpenFangToast.success('Fallback removed');
      } catch(e) {
        OpenFangToast.error('Failed to save fallbacks: ' + e.message);
        this.detailAgent._fallbacks.splice(idx, 0, removed[0]);
      }
    },

    // ── Tool filters ──
    async loadToolFilters() {
      if (!this.detailAgent) return;
      this.toolFiltersLoading = true;
      try {
        this.toolFilters = await OpenFangAPI.get('/api/agents/' + this.detailAgent.id + '/tools');
      } catch(e) {
        this.toolFilters = { tool_allowlist: [], tool_blocklist: [] };
      }
      this.toolFiltersLoading = false;
    },

    addAllowTool() {
      var t = this.newAllowTool.trim();
      if (t && this.toolFilters.tool_allowlist.indexOf(t) === -1) {
        this.toolFilters.tool_allowlist.push(t);
        this.newAllowTool = '';
        this.saveToolFilters();
      }
    },

    removeAllowTool(tool) {
      this.toolFilters.tool_allowlist = this.toolFilters.tool_allowlist.filter(function(t) { return t !== tool; });
      this.saveToolFilters();
    },

    addBlockTool() {
      var t = this.newBlockTool.trim();
      if (t && this.toolFilters.tool_blocklist.indexOf(t) === -1) {
        this.toolFilters.tool_blocklist.push(t);
        this.newBlockTool = '';
        this.saveToolFilters();
      }
    },

    removeBlockTool(tool) {
      this.toolFilters.tool_blocklist = this.toolFilters.tool_blocklist.filter(function(t) { return t !== tool; });
      this.saveToolFilters();
    },

    async saveToolFilters() {
      if (!this.detailAgent) return;
      try {
        await OpenFangAPI.put('/api/agents/' + this.detailAgent.id + '/tools', this.toolFilters);
      } catch(e) {
        OpenFangToast.error('Failed to update tool filters: ' + e.message);
      }
    },

    async spawnBuiltin(t) {
      var toml = 'name = "' + t.name + '"\n';
      toml += 'description = "' + t.description.replace(/"/g, '\\"') + '"\n';
      toml += 'module = "builtin:chat"\n';
      toml += 'profile = "' + t.profile + '"\n\n';
      toml += '[model]\nprovider = "' + t.provider + '"\nmodel = "' + t.model + '"\n';
      toml += 'system_prompt = """\n' + t.system_prompt + '\n"""\n';

      try {
        var res = await OpenFangAPI.post('/api/agents', { manifest_toml: toml });
        if (res.agent_id) {
          OpenFangToast.success('Agent "' + t.name + '" spawned');
          await Alpine.store('app').refreshAgents();
          this.chatWithAgent({ id: res.agent_id, name: t.name, model_provider: t.provider, model_name: t.model });
        }
      } catch(e) {
        OpenFangToast.error('Failed to spawn agent: ' + e.message);
      }
    }
  };
}
