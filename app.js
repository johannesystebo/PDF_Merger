'use strict';

// Page elements and application state.
const elements = {
  chooseButton: document.getElementById('choose'),
  filePicker: document.getElementById('picker'),
  dropZone: document.getElementById('drop'),
  queue: document.getElementById('queue'),
  fileCount: document.getElementById('count'),
  fileList: document.getElementById('files'),
  totals: document.getElementById('total'),
  mergeButton: document.getElementById('merge'),
  clearButton: document.getElementById('clear'),
  status: document.getElementById('status'),
  downloadLink: document.getElementById('download'),
};

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = 1024 * BYTES_PER_KILOBYTE;
const MAX_COMBINED_BYTES = 100 * BYTES_PER_MEGABYTE;

// Each entry contains the original File and its page count, in merge order.
let entries = [];
let isBusy = false;
let downloadUrl = null;

function showStatus(text, isError = false) {
  elements.status.textContent = text;
  elements.status.classList.toggle('error', isError);
}

function discardDownload() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
  }

  downloadUrl = null;
  elements.downloadLink.hidden = true;
}

function formatFileSize(bytes) {
  if (bytes < BYTES_PER_MEGABYTE) {
    const kilobytes = Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE));
    return `${kilobytes} KB`;
  }

  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`;
}

function getTotalBytes() {
  return entries.reduce((total, entry) => total + entry.file.size, 0);
}

// Queue changes invalidate the previous merged download.
function updateEntry(index, action) {
  discardDownload();
  showStatus('');

  if (action === 'remove') {
    entries.splice(index, 1);
  } else {
    const targetIndex = action === 'up' ? index - 1 : index + 1;
    const entry = entries[index];
    entries[index] = entries[targetIndex];
    entries[targetIndex] = entry;
  }

  render();
}

function createFileListItem(entry, index) {
  const listItem = document.createElement('li');

  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = 'PDF';

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-info';

  const fileName = document.createElement('span');
  fileName.className = 'file-name';
  fileName.textContent = entry.file.name;
  fileName.title = entry.file.name;

  const fileMeta = document.createElement('span');
  const pageLabel = entry.pages === 1 ? 'page' : 'pages';
  fileMeta.className = 'file-meta';
  fileMeta.textContent = `${entry.pages} ${pageLabel} · ${formatFileSize(entry.file.size)}`;
  fileInfo.append(fileName, fileMeta);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const actionOptions = [
    { symbol: '↑', label: 'Move up', action: 'up', disabled: index === 0 },
    {
      symbol: '↓',
      label: 'Move down',
      action: 'down',
      disabled: index === entries.length - 1,
    },
    { symbol: '×', label: 'Remove', action: 'remove', disabled: false },
  ];

  for (const option of actionOptions) {
    const button = document.createElement('button');
    button.textContent = option.symbol;
    button.setAttribute('aria-label', `${option.label}: ${entry.file.name}`);
    button.title = option.label;
    button.disabled = isBusy || option.disabled;
    button.onclick = () => updateEntry(index, option.action);
    actions.append(button);
  }

  listItem.append(icon, fileInfo, actions);
  return listItem;
}

function render() {
  elements.queue.hidden = entries.length === 0;
  elements.fileCount.textContent = `(${entries.length})`;
  elements.fileList.replaceChildren();

  entries.forEach((entry, index) => {
    elements.fileList.append(createFileListItem(entry, index));
  });

  const totalPages = entries.reduce((total, entry) => total + entry.pages, 0);
  elements.totals.textContent = `${totalPages} pages · ${formatFileSize(getTotalBytes())}`;

  elements.mergeButton.disabled = isBusy || entries.length < 2;
  elements.chooseButton.disabled = isBusy;
  elements.clearButton.disabled = isBusy;
}

// Validate files before adding them to the queue.
async function addFiles(files) {
  if (isBusy || files.length === 0) {
    return;
  }

  isBusy = true;
  discardDownload();
  render();
  showStatus('Checking your PDFs…');

  const errors = [];

  try {
    for (const file of files) {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';

      if (!isPdf) {
        errors.push(`${file.name}: please choose a PDF.`);
        continue;
      }

      if (getTotalBytes() + file.size > MAX_COMBINED_BYTES) {
        errors.push(`${file.name}: the combined limit is 100 MB.`);
        continue;
      }

      try {
        const fileBytes = await file.arrayBuffer();
        const pdfDocument = await PDFLib.PDFDocument.load(fileBytes);
        const pageCount = pdfDocument.getPageCount();

        if (pageCount === 0) {
          throw new Error('Empty document');
        }

        entries.push({ file, pages: pageCount });
      } catch {
        errors.push(
          `${file.name}: could not open this PDF. Password-protected or damaged PDFs are not supported.`
        );
      }
    }
  } finally {
    isBusy = false;
    render();

    if (errors.length > 0) {
      showStatus(errors.join(' '), true);
    } else if (entries.length < 2) {
      showStatus('Add one more PDF to merge your documents.');
    } else {
      showStatus('Ready to merge. Use the arrows to change the order.');
    }
  }
}

async function mergeFiles() {
  if (isBusy || entries.length < 2) {
    return;
  }

  isBusy = true;
  discardDownload();
  render();

  try {
    const mergedDocument = await PDFLib.PDFDocument.create();

    for (let index = 0; index < entries.length; index++) {
      showStatus(`Merging document ${index + 1} of ${entries.length}…`);

      // Give the browser a chance to display progress between documents.
      await new Promise(resolve => setTimeout(resolve, 0));

      const fileBytes = await entries[index].file.arrayBuffer();
      const sourceDocument = await PDFLib.PDFDocument.load(fileBytes);
      const pages = await mergedDocument.copyPages(
        sourceDocument,
        sourceDocument.getPageIndices()
      );

      pages.forEach(page => mergedDocument.addPage(page));
    }

    const mergedBytes = await mergedDocument.save();
    const mergedFile = new Blob([mergedBytes], { type: 'application/pdf' });
    downloadUrl = URL.createObjectURL(mergedFile);

    elements.downloadLink.href = downloadUrl;
    elements.downloadLink.hidden = false;
    showStatus(
      `All done! ${entries.length} PDFs combined into ${mergedDocument.getPageCount()} pages. Your download is ready.`
    );
  } catch {
    showStatus(
      'We could not merge these PDFs. Try smaller files or export fresh PDF copies and try again.',
      true
    );
  } finally {
    isBusy = false;
    render();
  }
}

// Connect the file picker, drag-and-drop area, and queue controls.
elements.chooseButton.onclick = () => elements.filePicker.click();

elements.filePicker.onchange = () => {
  addFiles(Array.from(elements.filePicker.files));

  // Allow the same file to be selected again later.
  elements.filePicker.value = '';
};

// Prevent dropped files from navigating away from the app.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

elements.dropZone.ondragover = event => {
  event.preventDefault();

  if (!isBusy) {
    elements.dropZone.classList.add('over');
  }
};

elements.dropZone.ondragleave = () => {
  elements.dropZone.classList.remove('over');
};

elements.dropZone.ondrop = event => {
  event.preventDefault();
  elements.dropZone.classList.remove('over');
  addFiles(Array.from(event.dataTransfer.files));
};

elements.clearButton.onclick = () => {
  entries = [];
  discardDownload();
  showStatus('');
  render();
};

elements.mergeButton.onclick = mergeFiles;

if (!window.PDFLib) {
  isBusy = true;
  showStatus('The PDF tool could not load. Reload this page to try again.', true);
}

render();
