import { api } from "/static/js/api.js";
import { setAvatar } from "/static/js/avatars.js";

export async function initExplore() {
	let user;
	try {
		const result = await api.get("/api/auth/me");
		user = result.data.user;
	} catch {
		window.location.href = "/login";
		return;
	}

	const profileLink = document.getElementById("my-profile-link");
	profileLink.href = `/profile?username=${encodeURIComponent(user.username)}`;
	const account = document.getElementById("sidebar-account");
	account.hidden = false;
	const avatar = document.createElement("div");
	avatar.className = "avatar avatar-small";
	setAvatar(avatar, user.fullName, user.avatarUrl);
	const meta = document.createElement("div");
	meta.className = "user-meta";
	const name = document.createElement("span");
	name.className = "user-name";
	name.textContent = user.fullName;
	const handle = document.createElement("span");
	handle.className = "user-handle";
	handle.textContent = `@${user.username}`;
	meta.append(name, handle);
	account.append(avatar, meta);

	document.getElementById("logout-link").addEventListener("click", async (event) => {
		event.preventDefault();
		try { await api.post("/api/auth/logout"); } finally { window.location.href = "/login"; }
	});

	const form = document.getElementById("search-form");
	const input = document.getElementById("search-input");
	const results = document.getElementById("search-results");
	const status = document.getElementById("search-status");
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const query = input.value.trim();
		if (!query) {
			input.focus();
			status.textContent = "Enter a username to search.";
			return;
		}

		const button = form.querySelector("button[type=submit]");
		button.disabled = true;
		status.textContent = "Searching the community...";
		results.replaceChildren(makeLoading());
		try {
			const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
			const people = (response.data.users || []).filter((person) => person.id !== user.id);
			results.replaceChildren();
			if (!people.length) {
				status.textContent = "No matches yet.";
				results.append(makeEmpty("No people found", `No usernames start with “${query}”. Try another search.`));
				return;
			}
			status.textContent = `${people.length} ${people.length === 1 ? "person" : "people"} found`;
			for (const person of people) results.append(renderPerson(person));
		} catch (error) {
			status.textContent = "Search couldn't be completed.";
			results.replaceChildren(makeEmpty("Something went wrong", error.message || "Please try again."));
		} finally {
			button.disabled = false;
		}
	});
	input.focus({ preventScroll: true });
}

function renderPerson(person) {
	const card = document.createElement("article");
	card.className = "user-result";
	const avatar = document.createElement("div");
	avatar.className = "avatar";
	setAvatar(avatar, person.fullName, person.avatarUrl);
	const main = document.createElement("div");
	main.className = "user-result-main";
	const link = document.createElement("a");
	link.className = "user-result-name";
	link.href = `/profile?username=${encodeURIComponent(person.username)}`;
	link.textContent = person.fullName;
	const handle = document.createElement("span");
	handle.className = "user-result-handle";
	handle.textContent = `@${person.username}`;
	main.append(link, handle);
	if (person.bio) {
		const bio = document.createElement("p");
		bio.className = "user-result-bio";
		bio.textContent = person.bio;
		main.append(bio);
	}
	const follow = document.createElement("button");
	follow.type = "button";
	follow.className = "btn btn-secondary btn-small follow-btn";
	follow.dataset.userId = person.id;
	follow.textContent = "Follow";
	card.append(avatar, main, follow);
	return card;
}

function makeEmpty(title, message) {
	const empty = document.createElement("div");
	empty.className = "empty-state";
	const heading = document.createElement("strong");
	heading.textContent = title;
	const description = document.createElement("span");
	description.textContent = message;
	empty.append(heading, description);
	return empty;
}

function makeLoading() {
	const loading = document.createElement("div");
	loading.className = "loading";
	loading.textContent = "Searching...";
	return loading;
}
