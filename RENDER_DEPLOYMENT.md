# Deploy to Render

This project is a single Node.js/Express web service. Express serves both the REST API and the static frontend, so deploy one **Web Service**; do not create a separate static site for `frontend/`.

## Before you start

You need:

- The project pushed to a GitHub, GitLab, or Bitbucket repository connected to Render.
- A MongoDB Atlas cluster and a database user with read/write access to the application database.
- A strong, unique session secret. Generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; enter it directly in Render and do not commit it.

The complete system specification remains in [`project documentation.txt`](project%20documentation.txt).

## 1. Prepare MongoDB Atlas

1. In Atlas, create or select the deployment and database project for this application.
2. Under **Database Access**, create a dedicated database user. Use a strong password and grant only the permissions needed by this application. Do not use an Atlas account password as the application database password.
3. Under **Network Access**, allow connections from the Render service.
   - In Render, open the service's **Connect** menu and view **Outbound**. Add the listed outbound IP ranges to the Atlas IP access list. Render's [outbound IP documentation](https://render.com/docs/outbound-ip-addresses) explains how to find these ranges and the dedicated outbound IP option.
   - Avoid `0.0.0.0/0` when possible: it allows connection attempts from any IP and is not a strong network boundary. If you temporarily use it for a demonstration, use a dedicated strong database password, a least-privilege database user, and never reuse credentials. Remove the broad rule or replace it with restricted ranges after deployment.
4. In Atlas, choose **Connect** and copy the application connection string. It should use `mongodb+srv://` and identify the application database, for example:

   ```text
   mongodb+srv://<db-user>:<encoded-password>@<cluster-host>/social_media_platform?retryWrites=true&w=majority
   ```

   Replace the placeholders. URL-encode special characters in the username or password. Keep this URI private.

## 2. Create the Render Web Service

1. Push the desired branch to your Git provider and open the [Render Dashboard](https://dashboard.render.com/).
2. Select **New > Web Service** and connect the repository and deployment branch.
3. Configure the service:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Root Directory | Leave blank (repository root) |
   | Build Command | `cd backend && npm ci` |
   | Start Command | `cd backend && npm start` |
   | Health Check Path | `/api/health` |

   Keep the root directory at the repository root. The Express app resolves the sibling `frontend/` directory relative to `backend/src/app.js`; setting the Render root directory to `backend` can omit that frontend directory from the service checkout.
4. Choose the Render region and instance plan appropriate for the project. A free instance may sleep when idle and take time to wake on its next request; review Render's current [free web service limitations](https://render.com/docs/free) before choosing it.
5. Add the environment variables in the Render service's **Environment** settings:

   | Key | Value |
   | --- | --- |
   | `MONGODB_URI` | The Atlas connection string from the previous section |
   | `SESSION_SECRET` | A newly generated random secret, stored only in Render |
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `22` (Render supports Node version aliases; a specific supported 22.x patch can also be pinned) |

   Do **not** set `PORT` manually. Render supplies it, and `backend/src/server.js` uses `process.env.PORT`.
6. Create the service and follow the build and deploy logs. The start log should show a successful MongoDB connection and that the server is listening on Render's assigned port.

## 3. Verify the deployment

Use the service's `https://<service-name>.onrender.com` URL:

1. Open `/api/health`. Expect HTTP 200 and a JSON response with `success: true`.
2. Open `/login` and `/register`. Both should load with their CSS and icons. The frontend is served by the same Express origin as the API.
3. Register a new account, sign in, create a post, and verify the browser session persists between page/API requests.
4. Sign out and confirm protected actions require authentication.
5. Inspect Render logs for startup, database, and request errors. Do not paste secrets or full database URIs into logs or support requests.

The health endpoint currently confirms that the HTTP app is responding. Startup awaits the MongoDB connection, so a failed initial database connection prevents the server from listening.

## Troubleshooting

- **Build cannot find `package.json`:** confirm **Root Directory** is blank and the build command is `cd backend && npm ci`.
- **Frontend pages or `/static/...` assets return 404:** confirm the repository root is the service root, the `frontend/` directory is present in the deployed branch, and the server is running the current code.
- **MongoDB server selection or IP access errors:** verify `MONGODB_URI`, Atlas network access, cluster status, and database-user permissions. URL-encode special characters in URI credentials.
- **Login works but later requests look signed out:** confirm Render has the same stable `SESSION_SECRET` configured after deploys, `NODE_ENV=production`, and that the browser is using the HTTPS Render URL. Sessions are stored in MongoDB's `sessions` collection.
- **Render reports no open port:** keep the service type as **Web Service** and let Render provide `PORT`; do not hardcode a port for deployment.
- **Deploy works locally but not after a branch update:** verify the correct repository and branch are connected, then trigger a deploy and inspect its build/start logs.

## Security and operational notes

This is an MVP deployment guide, not a production security certification. Before opening the service to a broad public audience, review the security requirements in the project specification, particularly CSRF protection for cookie-authenticated state-changing requests, security headers, and rate limiting. Use a restricted Atlas network policy when possible, keep secrets in Render's environment settings, and configure appropriate database backups and monitoring for any data that must be retained.

Render's interface and plan capabilities can change. Check the current [Web Services documentation](https://render.com/docs/web-services), [Node/Express quickstart](https://render.com/docs/deploy-node-express-app), [health check documentation](https://render.com/docs/health-checks), and [MongoDB Atlas IP access list documentation](https://www.mongodb.com/docs/atlas/security/ip-access-list/) if a dashboard label differs from these instructions.
