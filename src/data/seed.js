export const stages = ['New', 'Contacted', 'Interested', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'];
export const dealStages = ['Qualification', 'Needs analysis', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const dealStageProbability = { Qualification: 10, 'Needs analysis': 25, Proposal: 50, Negotiation: 75, Won: 100, Lost: 0 };
export const leadSources = ['Website', 'LinkedIn', 'Referral', 'Google Ads', 'Webinar', 'Conference', 'Cold outreach', 'Web form', 'Import', 'Other'];

/** Defaults added to workspaces created before these features existed. */
export const defaultTemplates = [
  { id: 't1', name: 'First touch', category: 'Prospecting', subject: 'Quick idea for {{company}}', body: 'Hi {{first_name}},\n\nI noticed {{company}} is growing quickly and wanted to share how teams like yours use our platform to turn more conversations into customers.\n\nWould a 15-minute call next week be useful?\n\nBest,\n{{owner}}' },
  { id: 't2', name: 'Follow-up after call', category: 'Follow-up', subject: 'Great speaking with you, {{first_name}}', body: 'Hi {{first_name}},\n\nThanks for your time today. As promised, here is a short summary and the next steps we discussed.\n\nLet me know if anything is missing.\n\n{{owner}}' },
  { id: 't3', name: 'Proposal sent', category: 'Sales', subject: 'Your proposal for {{company}}', body: 'Hi {{first_name}},\n\nPlease find the proposal for {{company}} attached. Happy to walk through it together.\n\n{{owner}}' },
  { id: 't4', name: 'Re-engage', category: 'Nurture', subject: 'Still exploring options, {{first_name}}?', body: 'Hi {{first_name}},\n\nIt has been a while since we last spoke. Is improving your marketing pipeline still a priority at {{company}}?\n\n{{owner}}' }
];

export const defaultAutomations = [
  { id: 'r1', name: 'Welcome task for new leads', active: true, trigger: 'lead_created', conditionField: '', conditionValue: '', actions: [{ type: 'create_task', title: 'Intro call with {{name}}', taskType: 'Call', dueInDays: 1 }], runs: 0 },
  { id: 'r2', name: 'Prepare proposal when qualified', active: true, trigger: 'stage_changed', conditionField: 'status', conditionValue: 'Qualified', actions: [{ type: 'create_task', title: 'Prepare proposal for {{company}}', taskType: 'Follow-up', dueInDays: 2 }, { type: 'add_tag', tag: 'sales-ready' }], runs: 0 },
  { id: 'r3', name: 'Hot referral leads', active: true, trigger: 'lead_created', conditionField: 'source', conditionValue: 'Referral', actions: [{ type: 'set_priority', priority: 'High' }, { type: 'add_tag', tag: 'referral' }], runs: 0 }
];

export const initialData = {
  leads: [
    { id: 'l1', name: 'Olivia Rhye', email: 'olivia@acme.io', phone: '+1 415 555 0101', whatsapp: '+1 415 555 0101', company: 'Acme Studio', location: 'San Francisco, CA', source: 'LinkedIn', campaign: 'Spring product launch', status: 'Qualified', priority: 'High', budget: 24000, tags: ['enterprise'], owner: 'Maya Chen', notes: 'Evaluating team plan; send security overview.', followUp: '2025-06-20', createdAt: '2025-06-12' },
    { id: 'l2', name: 'Phoenix Baker', email: 'phoenix@linear.app', phone: '+1 212 555 0145', whatsapp: '', company: 'Linear Labs', location: 'New York, NY', source: 'Website', campaign: 'Always-on search', status: 'Interested', priority: 'Medium', budget: 18000, owner: 'Jordan Lee', notes: 'Requested a product walkthrough.', followUp: '2025-06-19', createdAt: '2025-06-11' },
    { id: 'l3', name: 'Lana Steiner', email: 'lana@figma.design', phone: '+1 206 555 0112', whatsapp: '', company: 'Figma North', location: 'Seattle, WA', source: 'Referral', campaign: 'Partner referrals', status: 'Proposal', priority: 'High', budget: 42000, owner: 'Maya Chen', notes: 'Proposal sent; procurement review pending.', followUp: '2025-06-18', createdAt: '2025-06-10' },
    { id: 'l4', name: 'Demi Wilkinson', email: 'demi@orbit.co', phone: '+1 312 555 0173', whatsapp: '', company: 'Orbit Co', location: 'Chicago, IL', source: 'Webinar', campaign: 'Growth webinar', status: 'New', priority: 'Low', budget: 9000, owner: 'Sam Rivera', notes: '', followUp: '2025-06-22', createdAt: '2025-06-09' },
    { id: 'l5', name: 'Candice Wu', email: 'candice@catalog.com', phone: '+1 512 555 0188', whatsapp: '', company: 'Catalog', location: 'Austin, TX', source: 'Google Ads', campaign: 'Always-on search', status: 'Contacted', priority: 'Medium', budget: 12500, owner: 'Jordan Lee', notes: 'Call back after internal review.', followUp: '2025-06-21', createdAt: '2025-06-08' },
    { id: 'l6', name: 'Natali Craig', email: 'natali@company.io', phone: '+1 617 555 0123', whatsapp: '', company: 'Company.io', location: 'Boston, MA', source: 'Conference', campaign: 'SaaS Summit', status: 'Negotiation', priority: 'High', budget: 36000, owner: 'Maya Chen', notes: 'Discussing annual terms.', followUp: '2025-06-17', createdAt: '2025-06-07' },
    { id: 'l7', name: 'Drew Cano', email: 'drew@layers.to', phone: '+1 305 555 0156', whatsapp: '', company: 'Layers', location: 'Miami, FL', source: 'Website', campaign: 'Spring product launch', status: 'Converted', priority: 'Medium', budget: 22000, owner: 'Sam Rivera', notes: 'Converted to annual customer.', followUp: '', createdAt: '2025-06-05' },
    { id: 'l8', name: 'Orlando Diggs', email: 'orlando@circooles.com', phone: '+1 303 555 0134', whatsapp: '', company: 'Circooles', location: 'Denver, CO', source: 'Cold outreach', campaign: 'Outbound Q2', status: 'Lost', priority: 'Low', budget: 7000, owner: 'Jordan Lee', notes: 'Timing not right; revisit next quarter.', followUp: '', createdAt: '2025-06-04' }
  ],
  campaigns: [
    { id: 'c1', name: 'Spring product launch', channel: 'LinkedIn + email', budget: 12000, leads: 86, conversions: 14, revenue: 67200, status: 'Active' },
    { id: 'c2', name: 'Always-on search', channel: 'Google Ads', budget: 8500, leads: 64, conversions: 9, revenue: 38250, status: 'Active' },
    { id: 'c3', name: 'Growth webinar', channel: 'Events', budget: 4200, leads: 42, conversions: 6, revenue: 25800, status: 'Active' },
    { id: 'c4', name: 'Partner referrals', channel: 'Partners', budget: 3000, leads: 28, conversions: 8, revenue: 49600, status: 'Completed' }
  ],
  activities: [
    { id: 'a1', title: 'Send security overview to Olivia', type: 'Email', due: '2025-06-20', owner: 'Maya Chen', lead: 'Olivia Rhye', done: false },
    { id: 'a2', title: 'Product walkthrough with Phoenix', type: 'Meeting', due: '2025-06-19', owner: 'Jordan Lee', lead: 'Phoenix Baker', done: false },
    { id: 'a3', title: 'Review annual proposal', type: 'Follow-up', due: '2025-06-18', owner: 'Maya Chen', lead: 'Lana Steiner', done: false },
    { id: 'a4', title: 'Call back about team plan', type: 'Call', due: '2025-06-17', owner: 'Jordan Lee', lead: 'Candice Wu', done: true }
  ],
  companies: [
    { id: 'co1', name: 'Acme Studio', industry: 'Design', website: 'acme.io', phone: '+1 415 555 0100', size: '11-50', city: 'San Francisco, CA', owner: 'Maya Chen', notes: '' },
    { id: 'co2', name: 'Figma North', industry: 'Software', website: 'figma.design', phone: '+1 206 555 0110', size: '201-500', city: 'Seattle, WA', owner: 'Maya Chen', notes: 'Procurement requires security review.' },
    { id: 'co3', name: 'Company.io', industry: 'SaaS', website: 'company.io', phone: '+1 617 555 0120', size: '51-200', city: 'Boston, MA', owner: 'Maya Chen', notes: '' }
  ],
  deals: [
    { id: 'd1', name: 'Acme team plan', company: 'Acme Studio', contact: 'Olivia Rhye', value: 24000, stage: 'Needs analysis', probability: 25, closeDate: '2025-07-15', owner: 'Maya Chen', notes: '' },
    { id: 'd2', name: 'Figma North enterprise', company: 'Figma North', contact: 'Lana Steiner', value: 42000, stage: 'Proposal', probability: 50, closeDate: '2025-07-01', owner: 'Maya Chen', notes: '' },
    { id: 'd3', name: 'Company.io annual', company: 'Company.io', contact: 'Natali Craig', value: 36000, stage: 'Negotiation', probability: 75, closeDate: '2025-06-28', owner: 'Maya Chen', notes: '' },
    { id: 'd4', name: 'Layers renewal', company: 'Layers', contact: 'Drew Cano', value: 22000, stage: 'Won', probability: 100, closeDate: '2025-06-05', owner: 'Sam Rivera', notes: '' }
  ],
  products: [
    { id: 'p1', name: 'Growth plan (annual)', sku: 'GRW-12', price: 4800, description: 'Up to 10 seats, all marketing features', active: true },
    { id: 'p2', name: 'Onboarding package', sku: 'ONB-01', price: 1500, description: 'Setup, data import and training', active: true },
    { id: 'p3', name: 'Additional seat', sku: 'SEAT-1', price: 360, description: 'One extra user, billed yearly', active: true }
  ],
  invoices: [
    { id: 'i1', number: 'Q-1001', type: 'Quote', client: 'Figma North', email: 'lana@figma.design', issueDate: '2025-06-10', dueDate: '2025-06-30', status: 'Sent', taxRate: 8, discount: 0, notes: 'Valid for 30 days.', items: [{ id: 'li1', description: 'Growth plan (annual)', qty: 5, price: 4800 }, { id: 'li2', description: 'Onboarding package', qty: 1, price: 1500 }] },
    { id: 'i2', number: 'INV-1001', type: 'Invoice', client: 'Layers', email: 'drew@layers.to', issueDate: '2025-06-05', dueDate: '2025-07-05', status: 'Paid', taxRate: 0, discount: 0, notes: '', items: [{ id: 'li3', description: 'Growth plan (annual)', qty: 4, price: 4800 }, { id: 'li4', description: 'Onboarding package', qty: 1, price: 1500 }] }
  ],
  templates: defaultTemplates,
  automations: defaultAutomations,
  team: [
    { id: 'u1', name: 'Maya Chen', email: 'maya@northstar.io', role: 'Admin', status: 'Active', leads: 18, conversions: 7, initials: 'MC' },
    { id: 'u2', name: 'Jordan Lee', email: 'jordan@northstar.io', role: 'Manager', status: 'Active', leads: 14, conversions: 5, initials: 'JL' },
    { id: 'u3', name: 'Sam Rivera', email: 'sam@northstar.io', role: 'Employee', status: 'Active', leads: 11, conversions: 4, initials: 'SR' },
    { id: 'u4', name: 'Taylor Kim', email: 'taylor@northstar.io', role: 'Employee', status: 'Invited', leads: 0, conversions: 0, initials: 'TK' }
  ]
};