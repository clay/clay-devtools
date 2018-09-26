var components = document.querySelectorAll('[data-uri]'),
  pageUri = document.querySelector('html').getAttribute('data-uri'),
  layoutUri = document.querySelector('html').getAttribute('data-layout-uri'),
  hiddenInput = document.createElement('input'),
  keystroke = '',
  selectedComponent,
  hiddenInput,
  infoContainer;

hiddenInput.classList.add('slip-hidden-input');
document.querySelector('body').appendChild(hiddenInput);
addInfoContainer();

components.forEach(addEvent);
addHierarchyClass();

document.addEventListener('keydown', getKeyInput);
document.addEventListener('keyup', evaluateKeystroke);

function addButtons() {
  const buttonContainer = document.createElement('div'),
    dataButton = document.createElement('a'),
    htmlButton = document.createElement('a'),
    unpublishedButton = document.createElement('a');

  buttonContainer.classList.add('component-actions');
  buttonContainer.classList.add('no-selection');
  buttonContainer.innerHTML = '<span class="component-name">No Component Selected</span>'
  dataButton.setAttribute('target', '_blank');
  dataButton.classList.add('component-data');
  dataButton.innerHTML = 'Data';
  buttonContainer.appendChild(dataButton);
  htmlButton.setAttribute('target', '_blank');
  htmlButton.innerHTML = 'HTML';
  htmlButton.classList.add('component-html');
  buttonContainer.appendChild(htmlButton);
  unpublishedButton.setAttribute('target', '_blank');
  unpublishedButton.innerHTML = 'Unpublished Data';
  unpublishedButton.classList.add('component-unpublished');
  buttonContainer.appendChild(unpublishedButton);

  addButtonEvents(buttonContainer);

  return buttonContainer;
}

function addButtonEvents(container) {
  Array.from(container.childNodes).forEach((child) => {
    child.addEventListener('click', (e) => { e.stopPropagation(); return true });
  });
}

function toTitleCase(string) {
  if (!string) { return; }

  let str = string.replace(/\-/g, ' ');

  str = str.toLowerCase().split(' ');

  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  }

  return str.join(' ');
}

function getComponentName(uri) {
  const result = /_components\/(.+?)[\/\.]/.exec(uri) || /_components\/(.*)/.exec(uri);

  return result && result[1];
}

function getInstance(uri) {
  const result = /\/_components\/.+?\/instances\/([^\.@]+)/.exec(uri);

  return result && result[1];
}

function getPageInstance(uri) {
  const result = /\/_pages\/([^\.\/]+)/.exec(uri);

  return result && result[1];
}

function addInfoContainer() {
  infoContainer = document.createElement('div');

  var pageInfoContainer = document.createElement('div'),
    pageButton = document.createElement('a'),
    layoutButton = document.createElement('a'),
    metaButton = document.createElement('a'),
    isPublished = pageUri.indexOf('@published') > -1,
    pageInstance = getPageInstance(pageUri).replace('@published', ''),
    uPageButton = document.createElement('a'),
    uLayoutButton = document.createElement('a');

  if (isPublished) {
    infoContainer.classList.add('published');
  }

  pageInfoContainer.innerHTML = `<span class="info-label">${isPublished ? 'Published' : 'Unpublished'}</span><span class="page-name">Page${pageInstance ? ` (${pageInstance})` : ''}</span>`;
  pageButton.setAttribute('href', `//${pageUri}`);
  pageButton.setAttribute('target', '_blank');
  pageButton.innerHTML = 'Page';
  pageInfoContainer.appendChild(pageButton);
  metaButton.setAttribute('href', `//${pageUri}/meta`);
  metaButton.setAttribute('target', '_blank');
  metaButton.innerHTML = 'Metadata';
  pageInfoContainer.appendChild(metaButton);
  layoutButton.setAttribute('href', `//${layoutUri}`);
  layoutButton.setAttribute('target', '_blank');
  layoutButton.innerHTML = 'Layout';
  pageInfoContainer.appendChild(layoutButton);
  pageInfoContainer.classList.add('page-actions');
  uPageButton.setAttribute('href', `//${pageUri.replace('@published', '')}`);
  uPageButton.setAttribute('target', '_blank');
  uPageButton.innerHTML = 'Unpublished Page';
  uPageButton.classList.add('component-unpublished');
  pageInfoContainer.appendChild(uPageButton);
  uLayoutButton.setAttribute('href', `//${layoutUri.replace('@published', '')}`);
  uLayoutButton.setAttribute('target', '_blank');
  uLayoutButton.innerHTML = 'Unpublished Layout';
  uLayoutButton.classList.add('component-unpublished');
  pageInfoContainer.appendChild(uLayoutButton);

  infoContainer.appendChild(pageInfoContainer);
  infoContainer.appendChild(addButtons());
  infoContainer.classList.add('slip-buttons');

  addButtonEvents(infoContainer);

  document.querySelector('body').appendChild(infoContainer);
}

function updateButtonValues(uri) {
  const label = infoContainer.querySelector('span.component-name'),
    container = infoContainer.querySelector('.component-actions'),
    dataButton = container.querySelector('.component-data'),
    htmlButton = container.querySelector('.component-html'),
    unpubButton = container.querySelector('.component-unpublished');

  let name, instance;

  if (uri.indexOf('/_pages/') > -1) {
    label.innerHTML = 'No Component Selected';
    container.classList.add('no-selection');

    return;
  }

  name = toTitleCase(getComponentName(uri));
  instance = getInstance(uri);

  label.innerHTML = `${name} (${instance})`;
  dataButton.setAttribute('href', `//${uri}`);
  htmlButton.setAttribute('href', `//${uri}.html`);
  unpubButton.setAttribute('href', `//${uri.replace('@published', '')}`);

  container.classList.remove('no-selection');
}

function evaluateKeystroke(e) {
  if (keystroke === e.key) {
    return;
  }

  if (e.key === 'p') {
    hiddenInput.value = pageUri;
  } else if (e.key === 'c' && selectedComponent) {
    hiddenInput.value = selectedComponent.getAttribute('data-uri');
  }

  if (keystroke === 'y') {
    copyInput();
    keystroke = '';
  } else if (keystroke === 'o') {
    uri = hiddenInput.value;
    opts = { url: `http://${uri}` };
    chrome.runtime.sendMessage(opts);
    keystroke = '';
  }
}

function getKeyInput(e) {
  if (e.key === 'y') {
    keystroke = 'y';
  } else if (e.key === 'o') {
    keystroke = 'o';
  }
}

function copyInput() {
  hiddenInput.select();
  document.execCommand('copy');
  hiddenInput.blur();
}

function addEvent(el) {
  el.addEventListener('click', clickEvent);
}

function addHierarchyClass() {
  let lastElem,
    i = 0;

  components.forEach(function(el) {
    if (lastElem && el.parentNode !== lastElem.parentNode) {
      i += 1;
    }
    el.classList.add(`color-${i % 5}`);

    lastElem = el;
  });
}


function clickEvent(e) {
  e.stopPropagation();
  e.preventDefault();
  var uri = this.getAttribute('data-uri');

  if (selectedComponent) {
    selectedComponent.classList.toggle('slip-selected');
  }

  selectedComponent = this;
  selectedComponent.classList.add('slip-selected');
  hiddenInput.value = uri;

  updateButtonValues(uri);

  if (e.altKey || e.shiftKey) {
    var opts;

    opts = { url: `http://${uri}${e.altKey ? '.json' : ''}` };
    chrome.runtime.sendMessage(opts);
  }
}
