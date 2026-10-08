# PDF Merger

A simple, privacy-focused website for combining multiple PDFs into one file.

**Website:** https://pdfmerger.no

## Features

- Select or drag and drop PDF files
- Reorder documents before merging
- Download the combined PDF
- Process files locally in your browser—no PDF uploads to a server
- Supports up to 100 MB of combined input files

## Built with

- HTML, CSS, and JavaScript
- pdf-lib for PDF processing
- Vercel for hosting and deployment

## Run locally

Clone the repository:

git clone https://github.com/johannesystebo/PDF_Merger.git

Open index.html in your browser. No installation or build step is required.

## Project structure

PDF_Merger/
├── index.html
├── style.css
├── app.js
└── vendor/
    ├── pdf-lib.min.js
    └── LICENSE.md

## Privacy

Selected PDFs are processed in browser memory and are never uploaded
to a server. The hosting service delivers the website files;
PDF merging happens on your device.

## Limitations

Password-protected or damaged PDFs are not supported.
Large documents may exceed the browser’s available memory.

## Third-party license

This project uses pdf-lib, licensed under the MIT License.
Its copyright and license notice are included in vendor/LICENSE.md.
