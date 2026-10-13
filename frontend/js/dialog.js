export function openFormDialog({ title, fields, submitLabel = "Save changes" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "dialog-title");

    const header = document.createElement("header");
    header.className = "dialog-header";
    const heading = document.createElement("h2");
    heading.id = "dialog-title";
    heading.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn";
    close.setAttribute("aria-label", "Close dialog");
    close.innerHTML = '<svg class="icon"><use href="/static/assets/icons.svg#i-close"></use></svg>';
    header.append(heading, close);

    const form = document.createElement("form");
    const controls = new Map();
    for (const field of fields) {
      const wrapper = document.createElement("div");
      wrapper.className = "field";
      wrapper.style.marginBottom = "14px";
      const label = document.createElement("label");
      label.textContent = field.label;
      label.htmlFor = `dialog-${field.name}`;
      const control = field.multiline ? document.createElement("textarea") : document.createElement("input");
      control.id = label.htmlFor;
      control.name = field.name;
      control.value = field.value ?? "";
      control.maxLength = field.maxLength ?? 2000;
      if (field.placeholder) control.placeholder = field.placeholder;
      if (field.pattern) control.pattern = field.pattern;
      if (field.multiline) control.rows = field.rows ?? 4;
      wrapper.append(label, control);
      form.append(wrapper);
      controls.set(field.name, control);
    }

    const error = document.createElement("div");
    error.className = "form-error";
    error.setAttribute("role", "alert");
    form.append(error);
    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-secondary";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "btn btn-primary";
    submit.textContent = submitLabel;
    actions.append(cancel, submit);
    form.append(actions);
    dialog.append(header, form);
    backdrop.append(dialog);
    document.body.append(backdrop);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      backdrop.remove();
      resolve(value);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") finish(null);
    };

    close.addEventListener("click", () => finish(null));
    cancel.addEventListener("click", () => finish(null));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    document.addEventListener("keydown", onKeydown);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries([...controls].map(([name, input]) => [name, input.value.trim()]));
      if (fields.some((field) => field.required !== false && !values[field.name])) {
        error.textContent = "Please complete all fields.";
        return;
      }
      if (controls.get("username") && !/^[a-z0-9_]{3,20}$/.test(values.username)) {
        error.textContent = "Username must be 3–20 lowercase letters, numbers, or underscores.";
        controls.get("username").focus();
        return;
      }
      finish(values);
    });

    controls.values().next().value?.focus();
  });
}