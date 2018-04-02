
document.addEventListener("DOMContentLoaded", render);

document.oncontextmenu = function() {
  return false;
};

window.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
}, false);

browser.tabs.onActivated.addListener(activated);
browser.tabs.onUpdated.addListener(updated);
browser.tabs.onReplaced.addListener(replaced);
browser.tabs.onRemoved.addListener(removed);
browser.tabs.onMoved.addListener(render);
browser.tabs.onDetached.addListener(detached);
browser.tabs.onAttached.addListener(render);
browser.tabs.onCreated.addListener(render);

let EMPTY_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

let LAST_TITLE = {};
let CHANGED = {};
let VISITED = {};

function getAllTabs() {
  return browser.tabs.query({
    currentWindow: true,
  });
}

function getListedTabs() {
  return browser.tabs.query({
    currentWindow: true,
    pinned: false
  });
}

function getPinnedTabs() {
  return browser.tabs.query({
    currentWindow: true,
    pinned: true
  });
}

function removeAssociated(id) {
  delete CHANGED[id];
  delete VISITED[id];
  delete LAST_TITLE[id];
}

function replaced(id, info) {
  removeAssociated(id);
}

function removed(id, info) {
  removeAssociated(id);
}

function detached(id, info) {
  removeAssociated(id);
}

function updated(id, change, tab) {
  if (!tab.active) {
    if (change.title) {
      if (LAST_TITLE[id]) {
        if (change.title != LAST_TITLE[id]) {
          LAST_TITLE[id] = change.title;
          CHANGED[id] = true;
        }
      }
      else {
        LAST_TITLE[id] = change.title;
        CHANGED[id] = true;
      }
    }
  }
  render();
}

function activated(info) {
  VISITED[info.tabId] = true;
  delete CHANGED[info.tabId];
  render();
}

function render() {
  getListedTabs().then(updateTabList);
  getPinnedTabs().then(updatePinList);
  getAllTabs().then(updateCounter);
}

function updateCounter(tabs) {
  document.getElementById("footer").textContent = "" + tabs.length;
}

function updatePinList(tabs) {

  updateTabs(tabs, "pinlist", createPin, updatePin);

  let pinlist = document.getElementById("pinlist");
  if (pinlist) {

    let rect = pinlist.getBoundingClientRect();
    let height = Math.round(rect.height);
    let tablist = document.getElementById("tablist");

    if (tablist) {
      tablist.style.setProperty("margin-top", "" + height + "px");
    }
  }
}

function updateTabList(tabs) {

  updateTabs(tabs, "tablist", createRow, updateRow);
}

function createPin(tab) {

  let row = document.createElement("span");
  row.classList.add("pin");
  row.onmouseup = handleMouseUp;

  let favicon = document.createElement("img");
  favicon.classList.add("favicon");
  row.appendChild(favicon);

  updatePin(row, tab);

  return row;
}

function updateCommon(row, tab) {
  
  row.dataset.tab_id = tab.id;
  if (tab.active) {
    row.classList.add("active");
  }
  else {
    row.classList.remove("active");
  }

  if (tab.status && tab.status == "loading") {
    row.classList.add("loading");
  }
  else {
    row.classList.remove("loading");
  }

  let favicon_elems = row.getElementsByClassName("favicon");
  if (tab.favIconUrl) {
    favicon_elems[0].setAttribute("src", tab.favIconUrl);
  }
  else {
    favicon_elems[0].setAttribute("src", EMPTY_ICON);
  }

  if (CHANGED[tab.id]) {
    row.classList.add("changed");
  }
  else {
    row.classList.remove("changed");
  }
}

function updatePin(row, tab) {
  updateCommon(row, tab);
}

function updateTabs(tabs, name, create, update) {

  let list = document.getElementById(name);
  let rows = list.childNodes;

  tabs.forEach((tab, index) => {
    let row = rows[index];
    if (row) {
      update(row, tab);
    }
    else {
      let new_row = create(tab);
      list.appendChild(new_row);
    }
  });

  let remove = rows.length - tabs.length;
  while (remove > 0) {
    rows[tabs.length + remove - 1].remove();
    remove = remove - 1;
  }
}

function handleMouseUp(ev) {
  var ev = ev || window.event;
  if ('object' === typeof ev) {
    switch (ev.button) {
      case 0:
        handleLeftClick(this, ev);
        break;
      case 1:
        handleMiddleClick(this);
        break;
    }
  }
}

function isClickInIcon(row, name, ev) {
  let elems = row.getElementsByClassName(name);
  if (elems[0]) {
    let rect = elems[0].getBoundingClientRect();
    if (rect) {
      let x = ev.clientX;
      let y = ev.clientY;
      let rl = rect.left;
      let rr = rect.right;
      let rt = rect.top;
      let rb = rect.bottom;
      if (x >= rl && x <= rr && y >= rt && y <= rb) {
        return true;
      }
    }
  }
  return false;
}

function handleLeftClick(row, ev) {
  let id = row.dataset.tab_id;
  if (id) {
    if (isClickInIcon(row, "audibleicon", ev)) {
      browser.tabs.update(Number(id), { muted: true });
    }
    else if (isClickInIcon(row, "mutedicon", ev)) {
      browser.tabs.update(Number(id), { muted: false });
    }
    else {
      browser.tabs.update(Number(id), { active: true });
    }
  }
}

function handleMiddleClick(row) {
  let id = row.dataset.tab_id;
  if (id) {
    browser.tabs.remove(Number(id));
  }
}

function updateRow(row, tab) {

  updateCommon(row, tab);

  if (tab.audible) {
    let muted = false;
    if (tab.mutedInfo) {
      muted = tab.mutedInfo.muted;
    }
    if (muted) {
      row.classList.add("muted");
    }
    else {
      row.classList.add("audible");
    }
  }
  else {
    row.classList.remove("audible", "muted");
  }

  if (tab.discarded && !VISITED[tab.id]) {
    row.classList.add("unvisited");
  }
  else {
    row.classList.remove("unvisited");
  }

  let title_elems = row.getElementsByClassName("title");
  title_elems[0].textContent = tab.title;

  let line_elems = row.getElementsByClassName("line");
  line_elems[0].title = tab.title;
}

function createRow(tab) {

  let row = document.createElement("div");
  row.classList.add("tab");
  row.onmouseup = handleMouseUp;

  let line = document.createElement("span");
  line.classList.add("line");

  let favicon = document.createElement("img");
  favicon.classList.add("favicon");
  line.appendChild(favicon);

  let audible = document.createElement("span");
  audible.classList.add("audibleicon");
  audible.classList.add("flexicon");
  audible.textContent = "\u{1F50A}";
  line.appendChild(audible);

  let muted = document.createElement("span");
  muted.classList.add("mutedicon");
  muted.classList.add("flexicon");
  muted.textContent = "\u{1F508}";
  line.appendChild(muted);

  let title = document.createElement("span");
  title.classList.add("title");
  line.appendChild(title);

  row.appendChild(line);

  updateRow(row, tab);

  return row;
}

