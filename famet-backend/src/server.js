import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET;
const uploadDirectory = join(process.cwd(), "uploads");
const allowedImageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const allowedVideoTypes = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};
const allowedPostTypes = { ...allowedImageTypes, ...allowedVideoTypes };

mkdirSync(uploadDirectory, { recursive: true });
const uploadPhoto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${allowedImageTypes[file.mimetype] || ".img"}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(allowedImageTypes[file.mimetype])),
});
const uploadPostMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${allowedPostTypes[file.mimetype] || ".media"}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(allowedPostTypes[file.mimetype])),
});

if (!jwtSecret) throw new Error("JWT_SECRET is required. Copy .env.example to .env and set it.");

const allowedClientOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (for example, curl) are not browser CORS requests.
    const localViteOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):517[3-9]$/.test(origin || "");
    callback(null, !origin || allowedClientOrigins.includes(origin) || localViteOrigin);
  },
}));
app.use(express.json());
app.use("/uploads", express.static(uploadDirectory));

const publicUser = (user) => ({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, bio: user.bio, profilePhotoUrl: user.profilePhotoUrl });
const makeToken = (user) => jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
const validUsername = (username) => /^[a-z0-9._]{3,30}$/.test(username);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try { req.userId = jwt.verify(token, jwtSecret).userId; return next(); }
  catch { return res.status(401).json({ message: "Invalid or expired token." }); }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/search", auth, async (req, res, next) => {
  try {
    const query = req.query.q?.trim().slice(0, 100) || "";
    if (!query) return res.json({ users: [], posts: [] });
    const [users, foundPosts] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ] },
        select: {
          id: true,
          username: true,
          displayName: true,
          profilePhotoUrl: true,
          followers: { where: { followerId: req.userId }, select: { id: true } },
        },
        take: 10,
      }),
      prisma.post.findMany({
        where: { OR: [
          { caption: { contains: query, mode: "insensitive" } },
          { user: { is: { username: { contains: query, mode: "insensitive" } } } },
        ] },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { username: true, displayName: true, profilePhotoUrl: true } },
          taggedUsers: { select: { username: true } },
          likes: { where: { userId: req.userId }, select: { id: true } },
          comments: { orderBy: { createdAt: "asc" }, take: 20, include: { user: { select: { username: true } } } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
    ]);
    return res.json({
      users: users.map(({ followers, ...person }) => ({ ...person, isFollowing: followers.length > 0, isMe: person.id === req.userId })),
      posts: foundPosts.map((post) => ({ ...post, likedByMe: post.likes.length > 0 })),
    });
  } catch (error) { return next(error); }
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const { email, password, username, displayName } = req.body;
    const normalizedUsername = username?.trim().toLowerCase();
    if (!email || !password || !displayName || !validUsername(normalizedUsername)) return res.status(400).json({ message: "Provide a valid email, password, name, and user ID." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    const user = await prisma.user.create({ data: { email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12), username: normalizedUsername, displayName: displayName.trim() } });
    return res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) { return next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier?.trim().toLowerCase() }, { username: identifier?.trim().toLowerCase() }] } });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ message: "Incorrect login details." });
    return res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) { return next(error); }
});

app.get("/api/profile/me", auth, async (req, res, next) => {
  try { res.json({ user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: req.userId } })) }); }
  catch (error) { next(error); }
});

app.get("/api/profile/me/stats", auth, async (req, res, next) => {
  try {
    const [posts, followers, following] = await Promise.all([
      prisma.post.count({ where: { userId: req.userId } }),
      prisma.follow.count({ where: { followingId: req.userId } }),
      prisma.follow.count({ where: { followerId: req.userId } }),
    ]);
    return res.json({ posts, followers, following });
  } catch (error) { return next(error); }
});

app.get("/api/profile/me/followers", auth, async (req, res, next) => {
  try {
    const relations = await prisma.follow.findMany({
      where: { followingId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { follower: { select: { id: true, username: true, displayName: true, profilePhotoUrl: true } } },
    });
    const ids = relations.map(({ follower }) => follower.id);
    const followedIds = new Set((await prisma.follow.findMany({
      where: { followerId: req.userId, followingId: { in: ids } },
      select: { followingId: true },
    })).map(({ followingId }) => followingId));
    return res.json({ users: relations.map(({ follower }) => ({ ...follower, isFollowing: followedIds.has(follower.id) })) });
  } catch (error) { return next(error); }
});

app.get("/api/profile/me/following", auth, async (req, res, next) => {
  try {
    const relations = await prisma.follow.findMany({
      where: { followerId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { following: { select: { id: true, username: true, displayName: true, profilePhotoUrl: true } } },
    });
    return res.json({ users: relations.map(({ following }) => ({ ...following, isFollowing: true })) });
  } catch (error) { return next(error); }
});

app.post("/api/users/:userId/follow", auth, async (req, res, next) => {
  try {
    if (req.params.userId === req.userId) return res.status(400).json({ message: "You cannot follow your own account." });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId, followingId: req.params.userId } },
      update: {},
      create: { followerId: req.userId, followingId: req.params.userId },
    });
    return res.json({ following: true });
  } catch (error) {
    if (error.code === "P2003" || error.code === "P2025") return res.status(404).json({ message: "Account not found." });
    return next(error);
  }
});

app.delete("/api/users/:userId/follow", auth, async (req, res, next) => {
  try {
    await prisma.follow.deleteMany({ where: { followerId: req.userId, followingId: req.params.userId } });
    return res.json({ following: false });
  } catch (error) { return next(error); }
});

app.patch("/api/profile/me", auth, async (req, res, next) => {
  try {
    const { displayName, bio, username } = req.body;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    const nextUsername = username === undefined ? user.username : username.trim().toLowerCase();
    if (!validUsername(nextUsername)) return res.status(400).json({ message: "User ID must be 3-30 letters, numbers, periods, or underscores." });
    const month = currentMonth();
    const usedChanges = user.usernameChangeMonth === month ? user.usernameChangeCount : 0;
    if (nextUsername !== user.username && usedChanges >= 2) return res.status(429).json({ message: "You can change your user ID only twice per month." });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { displayName: displayName?.trim() ?? user.displayName, bio: bio?.trim() ?? user.bio, username: nextUsername, usernameChangeMonth: nextUsername === user.username ? user.usernameChangeMonth : month, usernameChangeCount: nextUsername === user.username ? user.usernameChangeCount : usedChanges + 1 } });
    return res.json({ user: publicUser(updated), usernameChangesRemaining: nextUsername === user.username ? 2 - usedChanges : 1 - usedChanges });
  } catch (error) { next(error); }
});

app.post("/api/profile/photo", auth, uploadPhoto.single("photo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a JPG, PNG, WebP, or GIF image to upload." });
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { profilePhotoUrl: `/uploads/${req.file.filename}` },
    });
    return res.json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});

app.get("/api/posts/me", auth, async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        taggedUsers: { select: { username: true } },
        likes: { where: { userId: req.userId }, select: { id: true } },
        comments: { orderBy: { createdAt: "asc" }, take: 20, include: { user: { select: { username: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return res.json({ posts: posts.map((post) => ({ ...post, likedByMe: post.likes.length > 0 })) });
  } catch (error) { return next(error); }
});

app.get("/api/posts", auth, async (_req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { username: true, displayName: true, profilePhotoUrl: true } },
        taggedUsers: { select: { username: true } },
        likes: { where: { userId: _req.userId }, select: { id: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { user: { select: { username: true } } },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return res.json({ posts: posts.map((post) => ({ ...post, likedByMe: post.likes.length > 0 })) });
  } catch (error) { return next(error); }
});

app.post("/api/posts/:postId/like", auth, async (req, res, next) => {
  try {
    await prisma.postLike.upsert({
      where: { userId_postId: { userId: req.userId, postId: req.params.postId } },
      update: {},
      create: { userId: req.userId, postId: req.params.postId },
    });
    const likeCount = await prisma.postLike.count({ where: { postId: req.params.postId } });
    return res.json({ liked: true, likeCount });
  } catch (error) {
    if (error.code === "P2003" || error.code === "P2025") return res.status(404).json({ message: "Post not found." });
    return next(error);
  }
});

app.delete("/api/posts/:postId/like", auth, async (req, res, next) => {
  try {
    await prisma.postLike.deleteMany({ where: { userId: req.userId, postId: req.params.postId } });
    const likeCount = await prisma.postLike.count({ where: { postId: req.params.postId } });
    return res.json({ liked: false, likeCount });
  } catch (error) { return next(error); }
});

app.post("/api/posts/:postId/comments", auth, async (req, res, next) => {
  try {
    const text = req.body.text?.trim();
    if (!text || text.length > 1000) return res.status(400).json({ message: "Write a comment with 1 to 1,000 characters." });
    const comment = await prisma.comment.create({
      data: { postId: req.params.postId, userId: req.userId, text },
      include: { user: { select: { username: true } } },
    });
    const commentCount = await prisma.comment.count({ where: { postId: req.params.postId } });
    return res.status(201).json({ comment, commentCount });
  } catch (error) {
    if (error.code === "P2003") return res.status(404).json({ message: "Post not found." });
    return next(error);
  }
});

app.get("/api/posts/saved/me", auth, async (req, res, next) => {
  try {
    const savedItems = await prisma.savedPost.findMany({
      where: { userId: req.userId },
      include: { post: {
        include: {
          taggedUsers: { select: { username: true } },
          likes: { where: { userId: req.userId }, select: { id: true } },
          comments: { orderBy: { createdAt: "asc" }, take: 20, include: { user: { select: { username: true } } } },
          _count: { select: { likes: true, comments: true } },
        },
      } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ posts: savedItems.map((item) => ({ ...item.post, likedByMe: item.post.likes.length > 0 })) });
  } catch (error) { return next(error); }
});

app.get("/api/posts/tagged/me", auth, async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { taggedUsers: { some: { id: req.userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        taggedUsers: { select: { username: true } },
        likes: { where: { userId: req.userId }, select: { id: true } },
        comments: { orderBy: { createdAt: "asc" }, take: 20, include: { user: { select: { username: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return res.json({ posts: posts.map((post) => ({ ...post, likedByMe: post.likes.length > 0 })) });
  } catch (error) { return next(error); }
});

app.post("/api/posts", auth, uploadPostMedia.single("media"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a supported photo or video to post." });
    if (req.file.mimetype.startsWith("image/") && req.file.size > 5 * 1024 * 1024) {
      unlinkSync(req.file.path);
      return res.status(413).json({ message: "Photos must be 5 MB or smaller." });
    }
    const taggedUsernames = [...new Set((req.body.taggedUsernames || "")
      .split(",")
      .map((username) => username.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean))];
    const taggedUsers = taggedUsernames.length
      ? await prisma.user.findMany({ where: { username: { in: taggedUsernames } }, select: { id: true } })
      : [];
    if (taggedUsers.length !== taggedUsernames.length) {
      unlinkSync(req.file.path);
      return res.status(400).json({ message: "One or more tagged usernames were not found. Tags must belong to Famet accounts." });
    }
    const post = await prisma.post.create({
      data: {
        userId: req.userId,
        mediaUrl: `/uploads/${req.file.filename}`,
        mediaType: req.file.mimetype.startsWith("video/") ? "video" : "image",
        caption: req.body.caption?.trim() || "",
        taggedUsers: { connect: taggedUsers.map(({ id }) => ({ id })) },
      },
      include: { taggedUsers: { select: { username: true } } },
    });
    return res.status(201).json({ post });
  } catch (error) { return next(error); }
});

app.post("/api/posts/:postId/save", auth, async (req, res, next) => {
  try {
    const saved = await prisma.savedPost.upsert({
      where: { userId_postId: { userId: req.userId, postId: req.params.postId } },
      update: {},
      create: { userId: req.userId, postId: req.params.postId },
    });
    return res.status(201).json({ saved: true, postId: saved.postId });
  } catch (error) {
    if (error.code === "P2003" || error.code === "P2025") return res.status(404).json({ message: "Post not found." });
    return next(error);
  }
});

app.delete("/api/posts/:postId/save", auth, async (req, res, next) => {
  try {
    await prisma.savedPost.deleteMany({ where: { userId: req.userId, postId: req.params.postId } });
    return res.json({ saved: false, postId: req.params.postId });
  } catch (error) { return next(error); }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "The selected file is too large. Profile photos must be 5 MB or smaller; posts must be 50 MB or smaller." });
  if (error instanceof multer.MulterError) return res.status(400).json({ message: "Could not upload that file. Choose a supported photo or video." });
  if (error.code === "P2002") return res.status(409).json({ message: "That email or user ID is already in use." });
  console.error(error);
  return res.status(500).json({ message: "Something went wrong." });
});

app.listen(port, () => console.log(`Famet API running at http://localhost:${port}`));
