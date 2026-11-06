export const stages = ['New', 'Contacted', 'Interested', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'];

export const initialData = {
  leads: [
    { id: 'l1', name: 'Olivia Rhye', email: 'olivia@acme.io', phone: '+1 415 555 0101', whatsapp: '+1 415 555 0101', company: 'Acme Studio', location: 'San Francisco, CA', source: 'LinkedIn', campaign: 'Spring product launch', status: 'Qualified', priority: 'High', budget: 24000, owner: 'Maya Chen', notes: 'Evaluating team plan; send security overview.', followUp: '2025-06-20', createdAt: '2025-06-12' },
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
  team: [
    { id: 'u1', name: 'Maya Chen', email: 'maya@northstar.io', role: 'Admin', status: 'Active', leads: 18, conversions: 7, initials: 'MC' },
    { id: 'u2', name: 'Jordan Lee', email: 'jordan@northstar.io', role: 'Manager', status: 'Active', leads: 14, conversions: 5, initials: 'JL' },
    { id: 'u3', name: 'Sam Rivera', email: 'sam@northstar.io', role: 'Employee', status: 'Active', leads: 11, conversions: 4, initials: 'SR' },
    { id: 'u4', name: 'Taylor Kim', email: 'taylor@northstar.io', role: 'Employee', status: 'Invited', leads: 0, conversions: 0, initials: 'TK' }
  ]
};