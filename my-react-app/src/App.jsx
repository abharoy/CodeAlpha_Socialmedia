import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

const navigate = (path) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

function Showcase() {
  return (
    <section className="showcase" aria-hidden="true">
      <div className="phone phone-back">
        <div className="phone-notch" />
        <div className="mini-header">
          <span>famet</span>
          <span>+</span>
        </div>
        <div className="post-art art-sky" />
        <div className="mini-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="phone phone-front">
        <div className="phone-notch" />
        <div className="story-row">
          <b />
          <b />
          <b />
          <b />
        </div>
        <div className="post-art art-sunset">
          <span>
            WANDER
            <br />
            MORE
          </span>
        </div>
        <div className="mini-lines">
          <i />
          <i className="wide" />
          <i />
        </div>
        <div className="mini-nav">Home Search Create Likes Profile</div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <nav>
        <a href="#about">About</a>
        <a href="#blog">Blog</a>
        <a href="#jobs">Jobs</a>
        <a href="#help">Help</a>
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
        <a href="#locations">Locations</a>
        <a href="#language">English</a>
      </nav>
      <span>(c) 2026 Famet</span>
    </footer>
  );
}

function SharePage({ token }) {
  const [media, setMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [taggedUsernames, setTaggedUsernames] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!media) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(media);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media]);

  async function submitPost(event) {
    event.preventDefault();
    if (!media) return;
    const maxSize = media.type.startsWith("image/")
      ? 5 * 1024 * 1024
      : 50 * 1024 * 1024;
    if (media.size > maxSize) {
      setMessage(
        media.type.startsWith("image/")
          ? "Photos must be 5 MB or smaller."
          : "Videos must be 50 MB or smaller.",
      );
      return;
    }
    const formData = new FormData();
    formData.append("media", media);
    formData.append("caption", caption);
    formData.append("taggedUsernames", taggedUsernames);
    setPosting(true);
    setMessage("");
    try {
      await apiRequest("/api/posts", { method: "POST", token, body: formData });
      navigate("/profile");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="share-page">
      <header className="profile-header">
        <button
          className="profile-brand"
          type="button"
          onClick={() => navigate("/profile")}
        >
          Famet
        </button>
        <nav>
          <button type="button" onClick={() => navigate("/profile")}>
            Cancel
          </button>
        </nav>
      </header>
      <form
        className={`share-card${media ? " has-media" : ""}`}
        onSubmit={submitPost}
      >
        <h1>Create new post</h1>
        {media ? (
          <>
            <div className="share-preview">
              {media.type.startsWith("video/") ? (
                <video src={previewUrl} controls />
              ) : (
                <img src={previewUrl} alt="Preview of your post" />
              )}
            </div>
            <label className="share-change">
              Choose different photo or video
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                onChange={(event) => setMedia(event.target.files?.[0] || null)}
              />
            </label>
            <label>
              Write a caption
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength="500"
                placeholder="Write a caption…"
              />
            </label>
            <label>
              Tag people
              <input
                value={taggedUsernames}
                onChange={(event) => setTaggedUsernames(event.target.value)}
                placeholder="Usernames separated by commas"
              />
            </label>
          </>
        ) : (
          <label
            className="media-picker"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setMedia(event.dataTransfer.files?.[0] || null);
            }}
          >
            <span className="media-picker-icon">▧</span>
            <b>Drag photos and videos here</b>
            <span>or choose a file from your device</span>
            <em>Select from computer</em>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={(event) => setMedia(event.target.files?.[0] || null)}
            />
          </label>
        )}
        <small>
          Photos up to 5 MB; videos up to 50 MB. Video formats: MP4, WebM, or
          MOV.
        </small>
        {message && <p className="form-message">{message}</p>}
        {media && (
          <button type="submit" disabled={posting}>
            {posting ? "Sharing…" : "Share"}
          </button>
        )}
      </form>
    </main>
  );
}

function HomePage({ token, onLogout }) {
  const searchInputRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [followingUsers, setFollowingUsers] = useState({});
  const [message, setMessage] = useState("");
  const [commentOpen, setCommentOpen] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  useEffect(() => {
    apiRequest("/api/posts", { token })
      .then(({ posts: recentPosts }) => setPosts(recentPosts))
      .catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    if (window.location.search === "?search=1") {
      searchInputRef.current?.focus();
      window.history.replaceState({}, "", "/home");
    }
  }, []);

  async function search(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setMessage("");
    try {
      const results = await apiRequest(
        `/api/search?q=${encodeURIComponent(query)}`,
        { token },
      );
      setSearchResults(results);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSearching(false);
    }
  }

  function updatePostLists(updatePost) {
    setPosts((current) => current.map(updatePost));
    setSearchResults((current) =>
      current ? { ...current, posts: current.posts.map(updatePost) } : current,
    );
  }

  async function toggleFollowPerson(person) {
    try {
      const result = await apiRequest(`/api/users/${person.id}/follow`, {
        method: person.isFollowing ? "DELETE" : "POST",
        token,
      });
      setSearchResults((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) =>
                item.id === person.id
                  ? { ...item, isFollowing: result.following }
                  : item,
              ),
            }
          : current,
      );
      setFollowingUsers((current) => ({
        ...current,
        [person.id]: result.following,
      }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleLike(post) {
    try {
      const result = await apiRequest(`/api/posts/${post.id}/like`, {
        method: post.likedByMe ? "DELETE" : "POST",
        token,
      });
      updatePostLists((item) =>
        item.id === post.id
          ? {
              ...item,
              likedByMe: result.liked,
              _count: { ...item._count, likes: result.likeCount },
            }
          : item,
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitComment(event, post) {
    event.preventDefault();
    const text = (commentDrafts[post.id] || "").trim();
    if (!text) return;
    try {
      const { comment, commentCount } = await apiRequest(
        `/api/posts/${post.id}/comments`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ text }),
        },
      );
      updatePostLists((item) =>
        item.id === post.id
          ? {
              ...item,
              comments: [...item.comments, comment],
              _count: { ...item._count, comments: commentCount },
            }
          : item,
      );
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function sharePost(post) {
    const url = `${window.location.origin}/home#post-${post.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: `Post by @${post.user.username}`,
          text: post.caption,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Post link copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setMessage(`Copy this post link: ${url}`);
    }
  }

  return (
    <main className="home-page">
      <header className="profile-header">
        <button
          className="profile-brand"
          type="button"
          onClick={() => navigate("/home")}
        >
          Famet
        </button>
        <form className="home-search" onSubmit={search}>
          <input
            ref={searchInputRef}
            aria-label="Search people and posts"
            placeholder="Search people and posts"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button type="submit" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
          {searchResults && (
            <button
              className="clear-search"
              type="button"
              onClick={() => {
                setSearchResults(null);
                setSearchQuery("");
              }}
            >
              Clear
            </button>
          )}
        </form>
        <nav>
          <button
            className="home-link"
            type="button"
            onClick={() => navigate("/home")}
          >
            Home
          </button>
          <button
            className="create-icon"
            type="button"
            onClick={() => navigate("/share")}
            aria-label="Create a post"
            title="Create a post"
          >
            +
          </button>
          <button type="button" onClick={() => navigate("/profile")}>
            My profile
          </button>
          <button type="button">Likes</button>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </nav>
      </header>
      <section className="feed-list">
        <h1>
          {searchResults
            ? `Search results for “${searchQuery.trim()}”`
            : "Recent posts"}
        </h1>
        {message && <p className="form-message">{message}</p>}
        {searchResults && (
          <section className="people-results">
            <h2>People</h2>
            {searchResults.users.length ? (
              searchResults.users.map((person) => (
                <article className="search-person" key={person.id}>
                  <div className="feed-avatar">
                    {person.profilePhotoUrl ? (
                      <img src={`${API_URL}${person.profilePhotoUrl}`} alt="" />
                    ) : (
                      person.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <b>{person.username}</b>
                    <small>{person.displayName}</small>
                  </div>
                  {!person.isMe && (
                    <button
                      type="button"
                      className="follow-button"
                      onClick={() => toggleFollowPerson(person)}
                    >
                      {(followingUsers[person.id] ?? person.isFollowing)
                        ? "Following"
                        : "Follow"}
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>No people found.</p>
            )}
            <h2>Posts</h2>
          </section>
        )}
        {(searchResults ? searchResults.posts : posts).length
          ? (searchResults ? searchResults.posts : posts).map((post) => (
              <article
                className="feed-card"
                id={`post-${post.id}`}
                key={post.id}
              >
                <header>
                  <div className="feed-avatar">
                    {post.user.profilePhotoUrl ? (
                      <img
                        src={`${API_URL}${post.user.profilePhotoUrl}`}
                        alt=""
                      />
                    ) : (
                      post.user.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <b>{post.user.username}</b>
                    <small>{post.user.displayName}</small>
                  </div>
                </header>
                {post.mediaType === "video" ? (
                  <video
                    src={`${API_URL}${post.mediaUrl}`}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img
                    className="feed-media"
                    src={`${API_URL}${post.mediaUrl}`}
                    alt={post.caption || "Post"}
                  />
                )}
                {post.caption && <p>{post.caption}</p>}
                <div className="feed-post-actions">
                  <button
                    type="button"
                    className={post.likedByMe ? "liked" : ""}
                    onClick={() => toggleLike(post)}
                  >
                    {post.likedByMe ? "Unlike" : "Like"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCommentOpen((current) => ({
                        ...current,
                        [post.id]: !current[post.id],
                      }))
                    }
                  >
                    Comment
                  </button>
                  <button type="button" onClick={() => sharePost(post)}>
                    Share
                  </button>
                </div>
                <div className="feed-counts">
                  <b>{post._count.likes}</b> likes ·{" "}
                  <b>{post._count.comments}</b> comments
                </div>
                {commentOpen[post.id] && (
                  <div className="feed-comments">
                    {post.comments.map((comment) => (
                      <p key={comment.id}>
                        <b>@{comment.user.username}</b> {comment.text}
                      </p>
                    ))}
                    <form onSubmit={(event) => submitComment(event, post)}>
                      <input
                        aria-label="Write a comment"
                        placeholder="Write a comment..."
                        maxLength="1000"
                        value={commentDrafts[post.id] || ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                      />
                      <button type="submit">Post</button>
                    </form>
                  </div>
                )}
              </article>
            ))
          : !message && (
              <p className="empty-posts">
                {searchResults
                  ? "No matching posts found."
                  : "No posts yet. Create one with the + button."}
              </p>
            )}
      </section>
    </main>
  );
}

function Profile({ user, token, onLogout, onUserUpdate }) {
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("posts");
  const [expandedTags, setExpandedTags] = useState({});
  const [commentOpen, setCommentOpen] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [relationshipType, setRelationshipType] = useState("");
  const [relationshipUsers, setRelationshipUsers] = useState([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const profile = { id: user.username, name: user.displayName, bio: user.bio };
  const visiblePosts =
    activeTab === "saved"
      ? savedPosts
      : activeTab === "tagged"
        ? taggedPosts
        : posts;
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest("/api/posts/me", { token }),
      apiRequest("/api/posts/saved/me", { token }),
      apiRequest("/api/profile/me/stats", { token }),
    ])
      .then(([{ posts: ownPosts }, { posts: savedItems }, currentStats]) => {
        setPosts(ownPosts);
        setSavedPosts(savedItems);
        setStats(currentStats);
      })
      .catch((error) => setNotice(error.message));
  }, [token]);

  async function openTab(tab) {
    setActiveTab(tab);
    setNotice("");
    if (tab === "saved" || tab === "tagged") {
      try {
        const { posts: loadedPosts } = await apiRequest(
          `/api/posts/${tab}/me`,
          { token },
        );
        if (tab === "saved") setSavedPosts(loadedPosts);
        else setTaggedPosts(loadedPosts);
      } catch (error) {
        setNotice(error.message);
      }
    }
  }

  async function openRelationships(type) {
    setRelationshipType(type);
    setLoadingRelationships(true);
    try {
      const { users } = await apiRequest(`/api/profile/me/${type}`, { token });
      setRelationshipUsers(users);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingRelationships(false);
    }
  }

  function showPosts() {
    setActiveTab("posts");
    document
      .getElementById("profile-post-tabs")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function toggleRelationship(person) {
    try {
      const result = await apiRequest(`/api/users/${person.id}/follow`, {
        method: person.isFollowing ? "DELETE" : "POST",
        token,
      });
      setRelationshipUsers((current) =>
        current.map((item) =>
          item.id === person.id
            ? { ...item, isFollowing: result.following }
            : item,
        ),
      );
      setStats((current) => ({
        ...current,
        following: current.following + (result.following ? 1 : -1),
      }));
    } catch (error) {
      setNotice(error.message);
    }
  }

  function toggleTagDisplay(postId) {
    setExpandedTags((current) => ({ ...current, [postId]: !current[postId] }));
  }

  async function toggleSaved(post) {
    const alreadySaved = savedPosts.some(
      (savedPost) => savedPost.id === post.id,
    );
    try {
      const result = await apiRequest(`/api/posts/${post.id}/save`, {
        method: alreadySaved ? "DELETE" : "POST",
        token,
      });
      setSavedPosts((current) =>
        alreadySaved
          ? current.filter((savedPost) => savedPost.id !== post.id)
          : [post, ...current],
      );
      setNotice(result.saved ? "Post saved." : "Post removed from Saved.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function toggleLike(post) {
    try {
      const result = await apiRequest(`/api/posts/${post.id}/like`, {
        method: post.likedByMe ? "DELETE" : "POST",
        token,
      });
      const update = (currentPosts) =>
        currentPosts.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likedByMe: result.liked,
                _count: { ...item._count, likes: result.likeCount },
              }
            : item,
        );
      setPosts(update);
      setSavedPosts(update);
      setTaggedPosts(update);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function submitComment(event, post) {
    event.preventDefault();
    const text = (commentDrafts[post.id] || "").trim();
    if (!text) return;
    try {
      const { comment, commentCount } = await apiRequest(
        `/api/posts/${post.id}/comments`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ text }),
        },
      );
      const update = (currentPosts) =>
        currentPosts.map((item) =>
          item.id === post.id
            ? {
                ...item,
                comments: [...item.comments, comment],
                _count: { ...item._count, comments: commentCount },
              }
            : item,
        );
      setPosts(update);
      setSavedPosts(update);
      setTaggedPosts(update);
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function sharePost(post) {
    const url = `${window.location.origin}/home#post-${post.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: `Post by @${user.username}`,
          text: post.caption,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Post link copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setNotice(`Copy this post link: ${url}`);
    }
  }

  async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setNotice("Choose an image smaller than 5 MB.");
      return;
    }
    const formData = new FormData();
    formData.append("photo", file);
    setUploadingPhoto(true);
    setNotice("");
    try {
      const { user: updatedUser } = await apiRequest("/api/profile/photo", {
        method: "POST",
        token,
        body: formData,
      });
      onUserUpdate(updatedUser);
      setNotice("Profile photo updated.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const cleanedId = draft.id.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(cleanedId)) {
      setNotice(
        "User ID must be 3-30 characters and use only letters, numbers, periods, or underscores.",
      );
      return;
    }
    try {
      const { user: updatedUser } = await apiRequest("/api/profile/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          username: cleanedId,
          displayName: draft.name,
          bio: draft.bio,
        }),
      });
      onUserUpdate(updatedUser);
      setEditing(false);
      setNotice("Profile saved.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <button
          className="profile-brand"
          type="button"
          onClick={() => navigate("/profile")}
        >
          Famet
        </button>
        <button
          className="profile-search"
          type="button"
          onClick={() => navigate("/home?search=1")}
        >
          Search people and posts
        </button>
        <nav>
          <button
            className="home-link"
            type="button"
            onClick={() => navigate("/home")}
          >
            Home
          </button>
          <button
            className="create-icon"
            type="button"
            onClick={() => navigate("/share")}
            aria-label="Create a post"
            title="Create a post"
          >
            +
          </button>
          <button type="button" onClick={() => navigate("/profile")}>
            Profile
          </button>
          <button type="button">Likes</button>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </nav>
      </header>
      <section className="profile-content">
        <div className="profile-top">
          <div className="avatar-wrap">
            <div className="avatar">
              {user.profilePhotoUrl ? (
                <img src={`${API_URL}${user.profilePhotoUrl}`} alt="Profile" />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
            <label className="avatar-upload">
              {uploadingPhoto ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={uploadProfilePhoto}
                disabled={uploadingPhoto}
              />
            </label>
            <p className="profile-photo-bio">{profile.bio}</p>
          </div>
          <div className="profile-details">
            <h1 className="profile-username">{profile.id}</h1>
            <p className="profile-display-name">
              <b>{profile.name}</b>
            </p>
            <div className="profile-stats">
              <button type="button" onClick={showPosts}>
                <b>{stats.posts}</b> posts
              </button>
              <button
                type="button"
                onClick={() => openRelationships("followers")}
              >
                <b>{stats.followers}</b> followers
              </button>
              <button
                type="button"
                onClick={() => openRelationships("following")}
              >
                <b>{stats.following}</b> following
              </button>
            </div>
            <div className="profile-actions">
              <button
                type="button"
                onClick={() => {
                  setDraft(profile);
                  setNotice("");
                  setEditing(true);
                }}
              >
                Edit profile
              </button>
              <button type="button">Settings</button>
            </div>
          </div>
        </div>
        {relationshipType && (
          <section className="relationship-panel">
            <header>
              <h2>
                {relationshipType === "followers" ? "Followers" : "Following"}
              </h2>
              <button type="button" onClick={() => setRelationshipType("")}>
                Close
              </button>
            </header>
            {loadingRelationships ? (
              <p>Loading accounts...</p>
            ) : relationshipUsers.length ? (
              relationshipUsers.map((person) => (
                <article className="search-person" key={person.id}>
                  <div className="feed-avatar">
                    {person.profilePhotoUrl ? (
                      <img src={`${API_URL}${person.profilePhotoUrl}`} alt="" />
                    ) : (
                      person.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <b>{person.username}</b>
                    <small>{person.displayName}</small>
                  </div>
                  <button
                    type="button"
                    className="follow-button"
                    onClick={() => toggleRelationship(person)}
                  >
                    {person.isFollowing ? "Following" : "Follow"}
                  </button>
                </article>
              ))
            ) : (
              <p>No {relationshipType} yet.</p>
            )}
          </section>
        )}
        {editing && (
          <form className="edit-profile" onSubmit={saveProfile}>
            <h2>Edit profile</h2>
            <label>
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              User ID
              <input
                value={draft.id}
                onChange={(event) =>
                  setDraft({ ...draft, id: event.target.value })
                }
                required
              />
              <small>You can change your user ID twice per month.</small>
            </label>
            <label>
              Bio
              <textarea
                value={draft.bio}
                onChange={(event) =>
                  setDraft({ ...draft, bio: event.target.value })
                }
                maxLength="150"
              />
            </label>
            <div>
              <button type="submit">Save changes</button>
              <button
                type="button"
                className="cancel"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {notice && <p className="profile-notice">{notice}</p>}
        <div className="profile-tabs" id="profile-post-tabs">
          <button
            className={activeTab === "posts" ? "active" : ""}
            onClick={() => openTab("posts")}
            type="button"
          >
            Posts
          </button>
          <button
            className={activeTab === "saved" ? "active" : ""}
            onClick={() => openTab("saved")}
            type="button"
          >
            Saved
          </button>
          <button
            className={activeTab === "tagged" ? "active" : ""}
            onClick={() => openTab("tagged")}
            type="button"
          >
            Tagged
          </button>
        </div>
        <div className="post-grid">
          {visiblePosts.length ? (
            visiblePosts.map((post) => (
              <article className="profile-post" key={post.id}>
                {post.mediaType === "video" ? (
                  <video
                    src={`${API_URL}${post.mediaUrl}`}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={`${API_URL}${post.mediaUrl}`}
                    alt={post.caption || "Profile post"}
                  />
                )}
                <div className="post-actions">
                  <button
                    className={
                      savedPosts.some((savedPost) => savedPost.id === post.id)
                        ? "saved"
                        : ""
                    }
                    type="button"
                    onClick={() => toggleSaved(post)}
                    aria-label={
                      savedPosts.some((savedPost) => savedPost.id === post.id)
                        ? "Remove from saved posts"
                        : "Save post"
                    }
                    title={
                      savedPosts.some((savedPost) => savedPost.id === post.id)
                        ? "Remove from saved posts"
                        : "Save post"
                    }
                  >
                    <svg
                      className="post-action-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M6 3.75h12v17l-6-4-6 4v-17Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTagDisplay(post.id)}
                    aria-label="Show tagged people"
                    title="Show tagged people"
                  >
                    <svg
                      className="post-action-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M20.25 13.5 13.5 20.25 3.75 10.5V3.75h6.75l9.75 9.75Z" />
                      <circle cx="8" cy="8" r="1.25" />
                    </svg>
                  </button>
                </div>
                {expandedTags[post.id] && (
                  <p className="post-tag-list">
                    {post.taggedUsers?.length
                      ? post.taggedUsers
                          .map((taggedUser) => `@${taggedUser.username}`)
                          .join(", ")
                      : "No one is tagged in this post."}
                  </p>
                )}
                {post.caption && <p className="post-caption">{post.caption}</p>}
                <div className="profile-engagement-actions">
                  <button
                    className={post.likedByMe ? "liked" : ""}
                    type="button"
                    onClick={() => toggleLike(post)}
                  >
                    {post.likedByMe ? "Unlike" : "Like"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCommentOpen((current) => ({
                        ...current,
                        [post.id]: !current[post.id],
                      }))
                    }
                  >
                    Comment
                  </button>
                  <button type="button" onClick={() => sharePost(post)}>
                    Share
                  </button>
                </div>
                <div className="profile-post-counts">
                  {post._count?.likes || 0} likes · {post._count?.comments || 0}{" "}
                  comments
                </div>
                {commentOpen[post.id] && (
                  <div className="profile-comments">
                    {(post.comments || []).map((comment) => (
                      <p key={comment.id}>
                        <b>@{comment.user.username}</b> {comment.text}
                      </p>
                    ))}
                    <form onSubmit={(event) => submitComment(event, post)}>
                      <input
                        aria-label="Write a comment"
                        placeholder="Write a comment..."
                        maxLength="1000"
                        value={commentDrafts[post.id] || ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                      />
                      <button type="submit">Post</button>
                    </form>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="empty-posts">
              {activeTab === "posts"
                ? "You haven't shared any posts yet."
                : activeTab === "saved"
                  ? "You haven't saved any posts yet."
                  : "You aren't tagged in any posts yet."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("famet-user") || "null");
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("famet-token"));

  useEffect(() => {
    if (window.location.pathname === "/")
      window.history.replaceState({}, "", "/login");
    const updateRoute = () => setRoute(window.location.pathname);
    updateRoute();
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  useEffect(() => {
    if (route !== "/profile" && route !== "/share" && route !== "/home") return;
    if (!token) {
      navigate("/login");
      return;
    }
    apiRequest("/api/profile/me", { token })
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        localStorage.setItem("famet-user", JSON.stringify(currentUser));
      })
      .catch(() => {
        localStorage.removeItem("famet-token");
        localStorage.removeItem("famet-user");
        setToken(null);
        setUser(null);
        navigate("/login");
      });
  }, [route, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const path = route === "/signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        route === "/signup"
          ? { displayName: fullName, email, username: signupUsername, password }
          : { identifier: username, password };
      const result = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      localStorage.setItem("famet-token", result.token);
      localStorage.setItem("famet-user", JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      navigate("/profile");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const isSignup = route === "/signup";
  if (route === "/home")
    return user && token ? (
      <HomePage
        token={token}
        onLogout={() => {
          localStorage.removeItem("famet-token");
          localStorage.removeItem("famet-user");
          setToken(null);
          setUser(null);
          navigate("/login");
        }}
      />
    ) : null;
  if (route === "/share")
    return user && token ? <SharePage token={token} /> : null;
  if (route === "/profile")
    return user ? (
      <Profile
        user={user}
        token={token}
        onUserUpdate={(updated) => {
          setUser(updated);
          localStorage.setItem("famet-user", JSON.stringify(updated));
        }}
        onLogout={() => {
          localStorage.removeItem("famet-token");
          localStorage.removeItem("famet-user");
          setToken(null);
          setUser(null);
          navigate("/login");
        }}
      />
    ) : null;
  return (
    <main className="login-page">
      <Showcase />
      <section className="login-column">
        <div className="login-card">
          <h1 className="brand">Famet</h1>
          {isSignup && (
            <p className="signup-intro">
              Sign up to see photos and updates from your friends.
            </p>
          )}
          <form onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <input
                  aria-label="Full name"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
                <input
                  aria-label="Email"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <input
                  aria-label="Username"
                  placeholder="Username"
                  value={signupUsername}
                  onChange={(event) => setSignupUsername(event.target.value)}
                  required
                />
              </>
            )}
            {!isSignup && (
              <input
                aria-label="Username or email"
                placeholder="Username or email"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            )}
            <div className="password-field">
              <input
                aria-label="Password"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {password && (
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={
                !password ||
                (isSignup ? !fullName || !email || !signupUsername : !username)
              }
            >
              {isSignup ? "Sign up" : "Log in"}
            </button>
          </form>
          {message && <p className="form-message">{message}</p>}
          {!isSignup && (
            <>
              <div className="divider">
                <span>OR</span>
              </div>
              <button
                className="facebook"
                type="button"
                onClick={() => setMessage("Facebook login would open here.")}
              >
                <strong>f</strong> Log in with Facebook
              </button>
              <button className="forgot" type="button">
                Forgot password?
              </button>
            </>
          )}
        </div>
        <div className="signup-card">
          {isSignup ? "Have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => navigate(isSignup ? "/login" : "/signup")}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </div>
        <p className="get-app">Get the app.</p>
        <div className="store-links">
          <button className="store" type="button">
            <small>Download on the</small>
            <b>App Store</b>
          </button>
          <button className="store play" type="button">
            <small>GET IT ON</small>
            <b>Google Play</b>
          </button>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export default App;
