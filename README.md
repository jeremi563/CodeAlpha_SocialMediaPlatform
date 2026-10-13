# Social Media Platform

A lightweight, full-stack social media web application built with a vanilla HTML/CSS/JavaScript frontend, Express API, and MongoDB.

---

## ✨ Features

- **User Profiles:** Create an account, manage personal bios, and view other users' profiles and activity.
- **Posts & Comments:** Share updates, thoughts, or media, and engage in conversations via post comments.
- **Like System:** Like and unlike posts to show appreciation for content.
- **Follow System:** Follow and unfollow other users to curate a personalized feed.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js and Express.js
- **Database:** MongoDB with Mongoose

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Make sure you have the following installed on your system:
- **Node.js** (v16+) & **npm** *(if using Express.js)* **OR** **Python** (v3.10+) & **pip** *(if using Django)*
- Git

### Installation

1. **Install backend dependencies:**
   ```bash
  cd backend
  npm install
   ```

2. **Configure the environment:** create `backend/.env` using `backend/.env.example` and set a MongoDB URI and session secret.

3. **Start the integrated application:**
  ```bash
  npm start
  ```
  For development with automatic restarts, run `npm run dev` instead. Both commands start the API and serve the frontend from the same Express process.

4. Open `http://localhost:5000` (or the configured `PORT`). The login, registration, feed, explore, and profile pages are served by the backend.

---

## 📂 Project Structure

```text
social-media-platform/
│
├── frontend/          # HTML, CSS, and client-side JavaScript
├── backend/           # Server-side logic (Django or Express)
└── README.md          # Project documentation
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git origin push feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.