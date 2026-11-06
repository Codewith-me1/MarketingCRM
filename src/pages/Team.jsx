import React, { useCallback, useEffect, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useCRM } from '../data/CRMContext';
import { initials } from '../common/format';
import PageTitle from '../components/ui/PageTitle';
import { appConfig } from '../supabase/supabase';
import {
  cancelTeamInvitation,
  createTeamInvitation,
  fetchPendingInvitations,
  invitationLink,
  removeTeamMember,
  updateTeamMemberRole
} from '../supabase/teamService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy was blocked. Select and copy the invitation link instead.');
}

const mailtoLink = (invite, inviterName) => {
  const subject = `${inviterName} invited you to ${appConfig.name}`;
  const body = [
    `Hi ${invite.invited_name || ''},`.trim(),
    '',
    `${inviterName} invited you to join their workspace on ${appConfig.name} as ${invite.role}.`,
    '',
    `Create your account with this email address (${invite.email}) using the link below:`,
    invitationLink(invite.token),
    '',
    `The invitation expires on ${new Date(invite.expires_at).toLocaleDateString()}.`
  ].join('\n');
  return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export default function Team() {
  const { data, workspaceOwnerId, user, displayName, refreshTeam } = useCRM();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Employee');
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState('');

  const loadInvitations = useCallback(async () => {
    if (!workspaceOwnerId) return;
    try {
      setInvitations(await fetchPendingInvitations(workspaceOwnerId));
    } catch (requestError) {
      console.error('Unable to load invitations:', requestError);
    }
  }, [workspaceOwnerId]);

  useEffect(() => {
    loadInvitations();
    refreshTeam().catch(requestError => setError(requestError.message || 'Team members could not be loaded.'));
  }, [loadInvitations, refreshTeam]);

  const run = async (key, action, successMessage) => {
    setRowBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message || 'The request failed. Please try again.');
    } finally {
      setRowBusy('');
    }
  };

  const invite = async event => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!name.trim() || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Enter a teammate name and a valid work email.');
      setNotice('');
      return;
    }
    if (data.team.some(member => member.email?.toLowerCase() === normalizedEmail)) {
      setError('This person is already a member of the workspace.');
      setNotice('');
      return;
    }
    if (!workspaceOwnerId) {
      setError('The workspace is still loading. Please try again.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const invitation = await createTeamInvitation(workspaceOwnerId, normalizedEmail, name.trim(), inviteRole);
      setInvitations(current => [invitation, ...current.filter(item => item.id !== invitation.id)]);
      setName('');
      setEmail('');
      try {
        await copyText(invitationLink(invitation.token));
        setNotice(`Invitation created for ${invitation.email} and the link was copied. Send it to them, or use "Email" below. They must sign up with that email address.`);
      } catch {
        setNotice(`Invitation created for ${invitation.email}. Copy the link below and send it to them.`);
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to create the invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="PEOPLE & PERMISSIONS"
        title="Team management"
        description="Invite teammates, manage roles, and review performance."
        actions={(
          <form className="inline-create" onSubmit={invite}>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Teammate name" aria-label="Teammate name" required />
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Work email" aria-label="Work email" required />
            <select className="role-select" value={inviteRole} onChange={event => setInviteRole(event.target.value)} aria-label="Role">
              <option>Employee</option>
              <option>Manager</option>
            </select>
            <button className="primary-button" type="submit" disabled={busy}><SafeIcon icon={FiIcons.FiUserPlus} /> {busy ? 'Inviting…' : 'Add member'}</button>
          </form>
        )}
      />
      {error && <p className="role-note role-error" role="alert">{error}</p>}
      {notice && <p className="role-note role-success" role="status">{notice}</p>}

      <section className="role-cards">
        <article><span className="role-card-icon role-admin"><SafeIcon icon={FiIcons.FiShield} /></span><h3>Admin</h3><p>Workspace settings, team management, and all records.</p><small>Full workspace access</small></article>
        <article><span className="role-card-icon role-manager"><SafeIcon icon={FiIcons.FiUsers} /></span><h3>Manager</h3><p>Manage team leads, campaigns, and performance reports.</p><small>Team access</small></article>
        <article><span className="role-card-icon role-employee"><SafeIcon icon={FiIcons.FiUser} /></span><h3>Employee</h3><p>Work assigned leads, update activities, and track follow-ups.</p><small>Assigned records</small></article>
      </section>

      <section className="panel table-panel team-table">
        <div className="panel-heading">
          <div>
            <h2>Workspace members</h2>
            <p>{data.team.length} {data.team.length === 1 ? 'person' : 'people'} · roles are stored in Supabase</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Member</th><th>Role</th><th>Status</th><th>Assigned leads</th><th>Conversions</th><th>Performance</th><th></th></tr>
            </thead>
            <tbody>
              {data.team.map(member => {
                const locked = member.isOwner || member.id === user?.id;
                return (
                  <tr key={member.id}>
                    <td>
                      <span className="lead-person">
                        <span className="avatar avatar-purple">{member.initials}</span>
                        <span><b>{member.name}{member.id === user?.id ? ' (you)' : ''}</b><small>{member.email}</small></span>
                      </span>
                    </td>
                    <td>
                      {locked
                        ? <span className="role-tag">{member.role}{member.isOwner ? ' · Owner' : ''}</span>
                        : (
                          <select
                            className="role-select"
                            value={member.role}
                            disabled={rowBusy === member.id}
                            aria-label={`Role for ${member.name}`}
                            onChange={event => {
                              const nextRole = event.target.value;
                              run(member.id, async () => {
                                await updateTeamMemberRole(member.id, nextRole);
                                await refreshTeam();
                              }, `${member.name} is now ${nextRole}.`);
                            }}
                          >
                            <option>Admin</option>
                            <option>Manager</option>
                            <option>Employee</option>
                          </select>
                        )}
                    </td>
                    <td><span className="status-chip status-qualified">{member.status}</span></td>
                    <td>{member.leads}</td>
                    <td>{member.conversions}</td>
                    <td><span className="member-performance"><i style={{ width: `${member.leads ? Math.round((member.conversions / member.leads) * 100) : 0}%` }}></i></span></td>
                    <td>
                      {!locked && (
                        <button
                          className="icon-button small-icon"
                          type="button"
                          aria-label={`Remove ${member.name}`}
                          title="Remove from workspace"
                          disabled={rowBusy === member.id}
                          onClick={() => {
                            if (!window.confirm(`Remove ${member.name} from this workspace?`)) return;
                            run(member.id, async () => {
                              await removeTeamMember(member.id);
                              await refreshTeam();
                            }, `${member.name} was removed from the workspace.`);
                          }}
                        >
                          <SafeIcon icon={FiIcons.FiUserX} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.team.length && <tr><td className="empty-cell" colSpan="7">No workspace members yet. Add a teammate above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel team-table">
        <div className="panel-heading">
          <div>
            <h2>Pending invitations</h2>
            <p>Invitations expire after seven days. The invitee must sign up with the invited email address.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Invitee</th><th>Role</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              {invitations.map(invitation => (
                <tr key={invitation.id}>
                  <td>
                    <span className="lead-person">
                      <span className="avatar avatar-blue">{initials(invitation.invited_name || invitation.email)}</span>
                      <span><b>{invitation.invited_name || invitation.email}</b><small>{invitation.email}</small></span>
                    </span>
                  </td>
                  <td><span className="role-tag">{invitation.role}</span></td>
                  <td>{invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className="invite-actions">
                      <button className="secondary-button" type="button" onClick={() => run(`copy-${invitation.id}`, () => copyText(invitationLink(invitation.token)), 'Invitation link copied.')}>
                        <SafeIcon icon={FiIcons.FiCopy} /> Copy link
                      </button>
                      <a className="secondary-button" href={mailtoLink(invitation, displayName)}>
                        <SafeIcon icon={FiIcons.FiMail} /> Email
                      </a>
                      <button
                        className="icon-button small-icon"
                        type="button"
                        aria-label={`Cancel invitation for ${invitation.email}`}
                        title="Cancel invitation"
                        disabled={rowBusy === invitation.id}
                        onClick={() => run(invitation.id, async () => {
                          await cancelTeamInvitation(invitation.id, workspaceOwnerId);
                          setInvitations(current => current.filter(item => item.id !== invitation.id));
                        }, 'Invitation cancelled.')}
                      >
                        <SafeIcon icon={FiIcons.FiX} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {!invitations.length && <tr><td className="empty-cell" colSpan="4">No pending invitations.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
