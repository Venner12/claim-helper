const claimButtons = document.querySelectorAll("[data-claim-type]");
const result = document.querySelector("#result");
const resultLabel = document.querySelector("#result-label");
const commentsAvailable = document.querySelector("#comments-available");
const commentsUsed = document.querySelector("#comments-used");
const youtubeAvailable = document.querySelector("#youtube-available");
const youtubeUsed = document.querySelector("#youtube-used");
const tiktokAvailable = document.querySelector("#tiktok-available");
const tiktokUsed = document.querySelector("#tiktok-used");
const logCount = document.querySelector("#log-count");
const adminPassword = document.querySelector("#admin-password");
const adminLoginButton = document.querySelector("#admin-login");
const adminLogoutButton = document.querySelector("#admin-logout");
const refreshAdminButton = document.querySelector("#refresh-admin");
const sectionTitle = document.querySelector("#section-title");
const sectionEyebrow = document.querySelector("#section-eyebrow");
const sectionEditor = document.querySelector("#section-editor");
const sectionInput = document.querySelector("#section-input");
const sectionInputLabel = document.querySelector("#section-input-label");
const sectionSaveButton = document.querySelector("#section-save");
const sectionAddButton = document.querySelector("#section-add");
const sectionListTitle = document.querySelector("#section-list-title");
const sectionList = document.querySelector("#section-list");
const sectionSearch = document.querySelector("#section-search");
const exportLogsButton = document.querySelector("#export-logs");
const clearUsedButton = document.querySelector("#clear-used");
const pagination = document.querySelector("#pagination");
const prevPageButton = document.querySelector("#prev-page");
const nextPageButton = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");

const PAGE_SIZE = 100;
let currentSectionRows = [];
let currentPage = 1;

const claimLabels = {
  comment: "comment",
  youtube: "YouTube link",
  tiktok: "TikTok link"
};

const sections = {
  comments: {
    title: "Comments",
    inputLabel: "Comments, one per line",
    addLabel: "Add More Comments",
    saveLabel: "Replace Comments",
    emptyText: "No comments loaded."
  },
  youtubeLinks: {
    title: "YouTube Links",
    inputLabel: "YouTube links, one per line",
    addLabel: "Add More YouTube Links",
    saveLabel: "Replace YouTube Links",
    emptyText: "No YouTube links loaded."
  },
  tiktokLinks: {
    title: "TikTok Links",
    inputLabel: "TikTok links, one per line",
    addLabel: "Add More TikTok Links",
    saveLabel: "Replace TikTok Links",
    emptyText: "No TikTok links loaded."
  },
  logs: {
    title: "Claim Log",
    emptyText: "No claims yet."
  }
};

if (adminPassword) {
  adminPassword.value = localStorage.getItem("claimHelperAdminPassword") || "";
  adminPassword.addEventListener("input", () => {
    localStorage.setItem("claimHelperAdminPassword", adminPassword.value);
  });
}

function adminHeaders() {
  const password = adminPassword
    ? adminPassword.value
    : localStorage.getItem("claimHelperAdminPassword") || "";
  if (!password) return {};
  return { "x-admin-password": password };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function goToLogin() {
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.href = `/admin-login.html?next=${next}`;
}

function handleAdminError(error) {
  if (error.message === "Admin password required.") {
    goToLogin();
    return;
  }

  alert(error.message);
}

function setResult(message, isError = false) {
  if (!result) return;
  result.textContent = message;
  result.classList.toggle("error", isError);
}

function renderStatus(status) {
  if (commentsAvailable) commentsAvailable.textContent = status.comments.available;
  if (commentsUsed) commentsUsed.textContent = status.comments.used;
  if (youtubeAvailable) youtubeAvailable.textContent = status.youtubeLinks.available;
  if (youtubeUsed) youtubeUsed.textContent = status.youtubeLinks.used;
  if (tiktokAvailable) tiktokAvailable.textContent = status.tiktokLinks.available;
  if (tiktokUsed) tiktokUsed.textContent = status.tiktokLinks.used;
}

async function refreshStatus() {
  const status = await requestJson("/api/status");
  renderStatus(status);
}

function renderRows(container, rows, emptyText, renderer) {
  container.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "row";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  rows.forEach((row) => {
    container.append(renderer(row));
  });
}

function makeCopyButton(value) {
  const button = document.createElement("button");
  button.className = "copy-button";
  button.type = "button";
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1200);
  });
  return button;
}

function renderItemRow(item) {
  const row = document.createElement("div");
  row.className = `row${item.claimedAt ? " used" : ""}`;

  const value = document.createElement("span");
  value.textContent = item.value;
  row.append(value);
  row.append(makeCopyButton(item.value));

  if (item.claimedAt) {
    const meta = document.createElement("small");
    meta.textContent = `Claimed ${new Date(item.claimedAt).toLocaleString()}`;
    row.append(meta);
  }

  return row;
}

function renderLogRow(log) {
  const row = document.createElement("div");
  row.className = "row";

  const value = document.createElement("span");
  value.textContent = log.value;
  row.append(value);
  row.append(makeCopyButton(log.value));

  const meta = document.createElement("small");
  meta.textContent = `${log.type} claimed ${new Date(log.claimedAt).toLocaleString()} from ${log.ip}`;
  row.append(meta);

  return row;
}

async function getAdminStore() {
  return requestJson("/api/admin/store", {
    headers: adminHeaders()
  });
}

async function refreshAdminDashboard() {
  await refreshStatus();

  if (logCount) {
    const store = await getAdminStore();
    logCount.textContent = `${store.logs.length} claim${store.logs.length === 1 ? "" : "s"}`;
  }
}

function getSelectedSection() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section") || "comments";
  return sections[section] ? section : "comments";
}

async function refreshAdminSection() {
  if (!sectionList) return;

  const selectedSection = getSelectedSection();
  const config = sections[selectedSection];
  const store = await getAdminStore();

  document.title = `${config.title} - Claim Helper Admin`;
  sectionTitle.textContent = config.title;
  sectionEyebrow.textContent = "Backend";
  sectionListTitle.textContent = config.title;
  if (sectionSearch) sectionSearch.value = "";
  currentPage = 1;

  if (selectedSection === "logs") {
    sectionEditor.hidden = true;
    if (clearUsedButton) clearUsedButton.hidden = true;
    if (exportLogsButton) exportLogsButton.hidden = false;
    currentSectionRows = store.logs;
    renderCurrentPage(config.emptyText, renderLogRow);
    return;
  }

  sectionEditor.hidden = false;
  if (clearUsedButton) clearUsedButton.hidden = false;
  if (exportLogsButton) exportLogsButton.hidden = true;
  sectionInputLabel.textContent = config.inputLabel;
  sectionAddButton.textContent = config.addLabel;
  sectionSaveButton.textContent = config.saveLabel;
  currentSectionRows = store[selectedSection];
  renderCurrentPage(config.emptyText, renderItemRow);
}

function getFilteredRows() {
  const searchText = sectionSearch ? sectionSearch.value.trim().toLowerCase() : "";
  if (!searchText) return currentSectionRows;

  return currentSectionRows.filter((row) => {
    const searchable = [
      row.value,
      row.type,
      row.ip,
      row.userAgent,
      row.claimedAt
    ].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(searchText);
  });
}

function renderCurrentPage(emptyText, renderer) {
  const rows = getFilteredRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  renderRows(sectionList, pageRows, emptyText, renderer);

  if (!pagination) return;
  pagination.hidden = rows.length <= PAGE_SIZE;
  pageStatus.textContent = `Page ${currentPage} of ${totalPages} (${rows.length} rows)`;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

async function submitSectionList(endpoint) {
  const selectedSection = getSelectedSection();
  if (selectedSection === "logs") return;

  const values = sectionInput.value.split("\n");
  const response = await requestJson(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify({ type: selectedSection, values })
  });
  sectionInput.value = "";
  await refreshAdminSection();
  if (response.skippedDuplicates) {
    alert(`${response.added} added. ${response.skippedDuplicates} duplicate${response.skippedDuplicates === 1 ? "" : "s"} skipped.`);
  }
}

claimButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const type = button.dataset.claimType;
    const label = claimLabels[type] || "item";
    button.disabled = true;
    if (resultLabel) resultLabel.textContent = `Your ${label}`;
    setResult(`Claiming the next ${label}...`);

    try {
      const claim = await requestJson(`/api/claim/${type}`, { method: "POST" });
      setResult(claim.value);
    } catch (error) {
      setResult(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
});

if (sectionSaveButton) {
  sectionSaveButton.addEventListener("click", async () => {
    const selectedSection = getSelectedSection();
    if (selectedSection === "logs") return;

    sectionSaveButton.disabled = true;

    try {
      const confirmed = confirm("Replace this entire list? Existing used and unused items in this section will be removed.");
      if (!confirmed) return;
      await submitSectionList("/api/admin/replace");
    } catch (error) {
      handleAdminError(error);
    } finally {
      sectionSaveButton.disabled = false;
    }
  });
}

if (sectionAddButton) {
  sectionAddButton.addEventListener("click", async () => {
    const selectedSection = getSelectedSection();
    if (selectedSection === "logs") return;

    sectionAddButton.disabled = true;

    try {
      await submitSectionList("/api/admin/add");
    } catch (error) {
      handleAdminError(error);
    } finally {
      sectionAddButton.disabled = false;
    }
  });
}

if (clearUsedButton) {
  clearUsedButton.addEventListener("click", async () => {
    const selectedSection = getSelectedSection();
    if (selectedSection === "logs") return;

    const confirmed = confirm("Remove all used items from this section? The claim log will stay.");
    if (!confirmed) return;

    clearUsedButton.disabled = true;

    try {
      await requestJson("/api/admin/clear-used", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...adminHeaders()
        },
        body: JSON.stringify({ type: selectedSection })
      });
      await refreshAdminSection();
    } catch (error) {
      handleAdminError(error);
    } finally {
      clearUsedButton.disabled = false;
    }
  });
}

if (exportLogsButton) {
  exportLogsButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/admin/export/logs.csv", {
        headers: adminHeaders()
      });
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) throw new Error("Could not export CSV.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "claim-log.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleAdminError(error);
    }
  });
}

if (sectionSearch) {
  sectionSearch.addEventListener("input", () => {
    const selectedSection = getSelectedSection();
    const renderer = selectedSection === "logs" ? renderLogRow : renderItemRow;
    currentPage = 1;
    renderCurrentPage(sections[selectedSection].emptyText, renderer);
  });
}

if (prevPageButton) {
  prevPageButton.addEventListener("click", () => {
    const selectedSection = getSelectedSection();
    const renderer = selectedSection === "logs" ? renderLogRow : renderItemRow;
    currentPage -= 1;
    renderCurrentPage(sections[selectedSection].emptyText, renderer);
  });
}

if (nextPageButton) {
  nextPageButton.addEventListener("click", () => {
    const selectedSection = getSelectedSection();
    const renderer = selectedSection === "logs" ? renderLogRow : renderItemRow;
    currentPage += 1;
    renderCurrentPage(sections[selectedSection].emptyText, renderer);
  });
}

if (adminLoginButton) {
  adminLoginButton.addEventListener("click", () => {
    localStorage.setItem("claimHelperAdminPassword", adminPassword.value);
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("next") || "/admin.html";
  });
}

if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", () => {
    localStorage.removeItem("claimHelperAdminPassword");
    window.location.href = "/admin-login.html";
  });
}

if (refreshAdminButton) {
  refreshAdminButton.addEventListener("click", async () => {
    try {
      if (sectionList) {
        await refreshAdminSection();
      } else {
        await refreshAdminDashboard();
      }
    } catch (error) {
      handleAdminError(error);
    }
  });
}

if (claimButtons.length) {
  refreshStatus().catch((error) => setResult(error.message, true));
}

if (logCount && !sectionList) {
  refreshAdminDashboard().catch(handleAdminError);
}

if (sectionList) {
  refreshAdminSection().catch(handleAdminError);
}
