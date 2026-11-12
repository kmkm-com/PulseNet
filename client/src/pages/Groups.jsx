import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import Icon from '../components/Icon.jsx';

export default function Groups() {
  const [groups, setGroups] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Create Group Form state
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadGroups = (query = '') => {
    groupsApi
      .list({ search: query })
      .then((data) => setGroups(data.groups))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadGroups(search);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim() || creating) return;

    setCreating(true);
    setCreateError('');
    try {
      await groupsApi.create({ name: name.trim(), description: description.trim(), visibility });
      setName('');
      setDescription('');
      setVisibility('public');
      setShowCreate(false);
      loadGroups();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="page page--narrow">
      <header className="page__header page__header--split">
        <div>
          <h1 className="page__title">Groups</h1>
          <p className="page__subtitle">Communities you can join and explore</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Icon name="plus" size={15} />
          <span>{showCreate ? 'Cancel' : 'Create Group'}</span>
        </button>
      </header>

      {/* Create Group Form Card */}
      {showCreate && (
        <form className="form-card" onSubmit={handleCreateGroup}>
          <h2 className="form-card__title">Create New Group</h2>
          {createError && <p className="form__error">{createError}</p>}
          <div className="field">
            <label className="field__label">Group Name</label>
            <input
              type="text"
              className="field__input"
              placeholder="e.g. React Developers, Database Enthusiasts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field__label">Description</label>
            <textarea
              className="composer__textarea"
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-card__footer">
            <div className="field-inline">
              <label className="field__label">Privacy:</label>
              <select
                className="composer__privacy"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="form-card__actions">
              <button type="button" className="button button--quiet" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={creating || !name.trim()}>
                {creating ? 'Creating…' : 'Create Group'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search Input */}
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          className="search-form__input"
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="button button--quiet">
          Search
        </button>
      </form>

      {error && <p className="form__error" role="alert">{error}</p>}
      {groups === null && !error && <p className="muted">Loading groups…</p>}
      {groups?.length === 0 && (
        <div className="empty">
          <p>No groups found. Create one above to get started.</p>
        </div>
      )}

      <div className="circle-cards">
        {groups?.map((g) => (
          <article key={g.group_id} className="circle-card">
            <div className="circle-card__header">
              <div>
                <Link to={`/groups/${g.group_id}`} className="circle-card__title">
                  {g.name}
                </Link>
                <div className="circle-card__tags">
                  <span className="tag">{g.visibility}</span>
                  {g.user_role && (
                    <span className="tag tag--role">
                      {g.user_role}
                    </span>
                  )}
                </div>
              </div>
              <Link to={`/groups/${g.group_id}`} className="button button--primary">
                View Group
              </Link>
            </div>
            {g.description && <p className="circle-card__desc">{g.description}</p>}
            <footer className="circle-card__footer">
              <span className="muted">
                👥 {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
