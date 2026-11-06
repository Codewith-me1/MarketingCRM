export const mockLeads = [
  { id: 1, name: "Alice Freeman", company: "TechNova", email: "alice@technova.com", phone: "(555) 123-4567", status: "Contacted", source: "Website", owner: "John Doe" },
  { id: 2, name: "Bob Smith", company: "Global Solutions", email: "bsmith@globalsol.net", phone: "(555) 987-6543", status: "New", source: "Referral", owner: "Jane Smith" },
  { id: 3, name: "Charlie Davis", company: "DataCorp", email: "charlie.d@datacorp.io", phone: "(555) 456-7890", status: "Qualified", source: "Trade Show", owner: "John Doe" },
  { id: 4, name: "Diana Prince", company: "Amazonian Tech", email: "diana@amazonian.com", phone: "(555) 777-8888", status: "Lost", source: "Cold Call", owner: "Mike Johnson" },
  { id: 5, name: "Evan Wright", company: "Wright & Co", email: "evan@wrightco.com", phone: "(555) 222-3333", status: "New", source: "Website", owner: "Jane Smith" },
  { id: 6, name: "Fiona Gallagher", company: "Southside Dev", email: "fiona@southside.dev", phone: "(555) 444-5555", status: "Contacted", source: "Partner", owner: "John Doe" },
];

export const mockDeals = [
  { id: 1, title: "TechNova Q3 Software Upgrade", amount: 45000, stage: "Needs Analysis", company: "TechNova", closingDate: "2023-10-15", owner: "John Doe" },
  { id: 2, title: "Global Solutions Enterprise License", amount: 120000, stage: "Proposal", company: "Global Solutions", closingDate: "2023-11-01", owner: "Jane Smith" },
  { id: 3, title: "DataCorp Cloud Migration", amount: 85000, stage: "Negotiation", company: "DataCorp", closingDate: "2023-09-30", owner: "John Doe" },
  { id: 4, title: "Amazonian Server Expansion", amount: 25000, stage: "Qualification", company: "Amazonian Tech", closingDate: "2023-12-15", owner: "Mike Johnson" },
  { id: 5, title: "Wright & Co Consulting Retainer", amount: 15000, stage: "Closed Won", company: "Wright & Co", closingDate: "2023-08-20", owner: "Jane Smith" },
  { id: 6, title: "Southside App Development", amount: 60000, stage: "Needs Analysis", company: "Southside Dev", closingDate: "2023-10-31", owner: "John Doe" },
];

export const dealStages = [
  "Qualification",
  "Needs Analysis",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost"
];

export const mockActivities = [
  { id: 1, type: "Call", description: "Follow up call with Alice regarding Q3 upgrade", date: "Today, 10:00 AM", user: "John Doe" },
  { id: 2, type: "Email", description: "Sent proposal to Global Solutions", date: "Yesterday, 2:30 PM", user: "Jane Smith" },
  { id: 3, type: "Meeting", description: "Initial discovery meeting with DataCorp", date: "Aug 25, 11:00 AM", user: "John Doe" },
  { id: 4, type: "Task", description: "Prepare presentation for Amazonian Tech", date: "Aug 24, 4:00 PM", user: "Mike Johnson" },
];

export const mockUsers = [
  { id: 1, name: "John Doe", email: "john@zetacrm.com", role: "Administrator", status: "Active", lastLogin: "2 mins ago", avatar: "JD" },
  { id: 2, name: "Jane Smith", email: "jane@zetacrm.com", role: "Manager", status: "Active", lastLogin: "1 hour ago", avatar: "JS" },
  { id: 3, name: "Mike Johnson", email: "mike@zetacrm.com", role: "Standard", status: "Active", lastLogin: "Yesterday", avatar: "MJ" },
  { id: 4, name: "Sarah Wilson", email: "sarah@zetacrm.com", role: "Standard", status: "Inactive", lastLogin: "5 days ago", avatar: "SW" },
];

export const rolePermissions = [
  { 
    role: "Administrator", 
    description: "Full access to all modules and settings.",
    permissions: { leads: "Full Access", deals: "Full Access", reports: "Full Access", settings: "Full Access" }
  },
  { 
    role: "Manager", 
    description: "Can manage team leads and deals but cannot change global settings.",
    permissions: { leads: "Full Access", deals: "Full Access", reports: "Read/Write", settings: "No Access" }
  },
  { 
    role: "Standard", 
    description: "Access to assigned leads and deals only.",
    permissions: { leads: "Restricted", deals: "Restricted", reports: "Read Only", settings: "No Access" }
  }
];