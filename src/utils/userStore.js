const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");

class UserStore {
  constructor() {
    this.users = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, "utf8");
        const parsed = JSON.parse(data);
        this.users = new Map(Object.entries(parsed));
        console.log(`Loaded ${this.users.size} users from storage`);
      }
    } catch (error) {
      console.error("Error loading users:", error.message);
      this.users = new Map();
    }
  }

  save() {
    try {
      const obj = Object.fromEntries(this.users);
      fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error("Error saving users:", error.message);
    }
  }

  get(chatId) {
    const key = String(chatId);
    if (!this.users.has(key)) {
      this.users.set(key, {});
    }
    return this.users.get(key);
  }

  set(chatId, data) {
    const key = String(chatId);
    const existing = this.get(key);
    this.users.set(key, { ...existing, ...data });
    this.save();
  }

  delete(chatId) {
    const key = String(chatId);
    this.users.delete(key);
    this.save();
  }

  getAll() {
    return Array.from(this.users.entries()).map(([chatId, data]) => ({
      chatId,
      ...data,
    }));
  }

  addHiddenStatus(chatId, status) {
    const user = this.get(chatId);
    const hidden = new Set(user.hiddenStatuses || []);
    hidden.add(status);
    this.set(chatId, { hiddenStatuses: Array.from(hidden) });
  }

  removeHiddenStatus(chatId, status) {
    const user = this.get(chatId);
    const hidden = new Set(user.hiddenStatuses || []);
    hidden.delete(status);
    this.set(chatId, { hiddenStatuses: Array.from(hidden) });
  }

  getHiddenStatuses(chatId) {
    const user = this.get(chatId);
    return user.hiddenStatuses || [];
  }

  clear() {
    this.users.clear();
    this.save();
  }
}

module.exports = new UserStore();
