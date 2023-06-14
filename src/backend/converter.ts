import fs from "fs";
import path from "path";
import child_process from "child_process";

import yazl from "yazl";
import config from "../../config.json";

import { getDocument as getPDFDocument, PDFDocumentProxy } from "pdfjs-dist";
import { EventEmitter } from "stream";

declare type pdfInformation = {
  author: string;
  pdfTitle: string;
  pageTitles: string[];
  pages: number;
  width: number;
  height: number;
  entries: any[];
};

function expandItems(items: any[], result: any[]) {
  for (let item of items) {
    result.push(item);
    if (item.items) {
      expandItems(item.items, result);
    }
  }
}

async function runPDF2SVG(
  filepath: string,
  pagesDirectory: string,
  filename: string
) {
  const pdf2svg: Promise<[string, string]> = new Promise((resolve, reject) => {
    const pagepath = path.join(pagesDirectory, `${filename}-page-%03d.svg`);
    child_process.exec(
      `pdf2svg "${filepath}" "${pagepath}" all`,
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        return resolve([stdout, stderr]);
      }
    );
  });
  return pdf2svg;
}

async function extractMeta(
  pdf: PDFDocumentProxy,
  pdfInfo: any,
  directory: string,
  filepath: string,
  filename: string,
  emitter: EventEmitter
): Promise<boolean> {
  try {
    const meta = await pdf.getMetadata();
    if (meta && meta.info) {
      const info: any = meta.info;
      if (info.Author) {
        pdfInfo.author = info.Author;
        emitter.emit("info", { message: "Autor gefunden: " + info.Author });
      }
      if (info.Title) {
        pdfInfo.pdfTitle = info.Title;
        emitter.emit("info", {
          message: "Dokumententitel gefunden: " + info.Title,
        });
      }
    }
    const pagesDirectory = path.join(directory, "pages");
    if (!fs.existsSync(pagesDirectory)) {
      fs.mkdirSync(pagesDirectory, { recursive: true });
    }
    try {
      const [stdout, stderr] = await runPDF2SVG(
        filepath,
        pagesDirectory,
        filename
      );
      if (stdout) console.log(stdout);
      if (stderr) console.log(stderr);
      emitter.emit("info", {
        message: "SVGs erfolgreich aus dem PDF extrahiert.",
      });
    } catch (error) {
      console.error(error);
      emitter.emit("info", {
        message:
          "Der Prozess war nicht in der Lage aus dem PDF SVGs zu extrahieren.",
      });
    }

    pdfInfo.pageTitles = [];
    for (const entry of pdfInfo.entries) {
      emitter.emit("info", {
        message: `Inhaltsverzeichniseintrag gefunden: Seite ${
          entry.page + 1
        } hat Titel ${entry.title}.`,
      });
      if (pdfInfo.pageTitles[entry.page]) {
        console.log("[pdf] Duplicate Bookmark Target:");
        console.log(entry);
        console.log(pdfInfo.pageTitles[entry.page]);
        emitter.emit("info", {
          message: `Mehrfacher Inhaltsverzeichniseintrag für Seite ${
            entry.page + 1
          } gefunden. Titel nicht mehr eindeutig. Verwende zuerst gefundenen Eintrag: ${
            pdfInfo.pageTitles[entry.page]
          }`,
        });
        continue;
      } else {
        pdfInfo.pageTitles[entry.page] = entry.title;
      }
    }
    let mostRecentTitle = "Unknown Title";
    let mostRecentPageWithTitle = 1;
    for (let page = 1; page <= pdfInfo.pages; page++) {
      if (pdfInfo.pageTitles[page]) {
        mostRecentTitle = pdfInfo.pageTitles[page];
        mostRecentPageWithTitle = page;
      } else {
        if (page === 1) {
          pdfInfo.pageTitles[page] = mostRecentTitle;
        } else {
          pdfInfo.pageTitles[page - 1] =
            mostRecentTitle + ` (${page - mostRecentPageWithTitle})`;
          pdfInfo.pageTitles[page] =
            mostRecentTitle + ` (${page - mostRecentPageWithTitle + 1})`;
        }
      }
    }
    emitter.emit("info", { message: "Generiere Decker Projektdateien." });
    let deckerSource = "---\n";
    deckerSource += `title: ${
      pdfInfo.pdfTitle ? pdfInfo.pdfTitle : "Unknown Presentation Title"
    }\n`;
    deckerSource += `author: ${
      pdfInfo.author ? pdfInfo.author : "Unknown Author"
    }\n`;
    deckerSource += `reveal:\n  width: ${pdfInfo.width}\n  height: ${pdfInfo.height}\n`;
    deckerSource += "---\n\n";
    for (let page = 1; page <= pdfInfo.pages; page++) {
      const pagenumber = String(page).padStart(3, "0");
      deckerSource += `# { menu-title="${pdfInfo.pageTitles[page]}" }\n\n`;
      deckerSource += `![](pages/${filename}-page-${pagenumber}.svg){width=var(--slide-width) height=var(--slide-height)}\n\n`;
    }
    const yamlPath = path.join(directory, "decker.yaml");
    fs.writeFileSync(yamlPath, "resource-pack: exe:tudo\n");
    const mdPath = path.join(directory, filename + "-deck.md");
    fs.writeFileSync(mdPath, deckerSource);
    emitter.emit("info", {
      message: "Stelle .zip-Datei zum Download zusammen.",
    });
    let zipfile = new yazl.ZipFile();
    zipfile.addFile(mdPath, path.basename(mdPath));
    zipfile.addFile(yamlPath, path.basename(yamlPath));
    for (let page = 1; page <= pdfInfo.pages; page++) {
      const pagenumber = String(page).padStart(3, "0");
      const pagefilename = `${filename}-page-${pagenumber}.svg`;
      const pagefile = path.join(pagesDirectory, pagefilename);
      if (fs.existsSync(pagefilename)) {
        zipfile.addFile(pagefile, path.join("pages", pagefilename));
      }
    }
    const zippath = path.join(directory, filename + ".tmp.zip");
    zipfile.outputStream
      .pipe(fs.createWriteStream(zippath))
      .on("close", function () {
        console.log("[yazl] Written file:", zippath);
        fs.rmSync(pagesDirectory, { recursive: true, force: true });
        fs.rmSync(mdPath, { force: true });
        fs.rmSync(yamlPath, { force: true });
        fs.renameSync(zippath, path.join(directory, filename + ".zip"));
        fs.rmSync(filepath);
        console.log("[yazl] Moved file and deleted temporary data.");
        emitter.emit("done", { message: "Konvertierung erfolgreich." });
      });
    zipfile.end();
    return true;
  } catch (error) {
    console.error(error);
    emitter.emit("error", { message: "Konvertierung wurde abgebrochen." });
    return false;
  }
}

export function Converter(filepath: string, emitter: EventEmitter) {
  console.log("[convert] Trying to convert file", filepath);
  const directory = path.dirname(filepath);
  const basename = path.basename(filepath);
  const filename = basename.substring(0, basename.lastIndexOf("."));
  // disableWorker = true;
  if (!filepath.endsWith(".pdf")) {
    console.error("[convert] Not a PDF.");
    return;
  }
  const dataBuffer = fs.readFileSync(filepath);
  let pdfInfo: pdfInformation = {
    author: "Unknown Author",
    pdfTitle: "Unknown Presentation Title",
    pageTitles: [],
    pages: 0,
    width: 0,
    height: 0,
    entries: [],
  };
  getPDFDocument(dataBuffer).promise.then(async (pdf) => {
    pdfInfo.pages = pdf.numPages;
    emitter.emit("info", { message: `${pdf.numPages} Seiten gefunden.` });
    for (let pageNum = 1; pageNum <= pdfInfo.pages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      pdfInfo.width = Math.max(pdfInfo.width, viewport.width);
      pdfInfo.height = Math.max(pdfInfo.height, viewport.height);
    }
    emitter.emit("info", {
      message: `Größte Seitendimensionen: ${pdfInfo.width}x${pdfInfo.height}`,
    });
    const outline = await pdf.getOutline();
    if (outline) {
      emitter.emit("info", {
        message: "PDF Outline gefunden. Inhaltsverzeichnis wird analysiert ...",
      });
      let items: any[] = [];
      expandItems(outline, items);
      let entries = [];
      for (const item of items) {
        const destination = item.dest;
        if (destination && typeof destination === "string") {
          const reference = await pdf.getDestination(destination);
          const target = reference[0];
          const id = await pdf.getPageIndex(target);
          const entry = { title: item.title, page: id + 1 };
          entries.push(entry);
        } else if (
          destination &&
          typeof destination === "object" &&
          Array.isArray(destination)
        ) {
          const reference = destination[0];
          const id = await pdf.getPageIndex(reference);
          const entry = { title: item.title, page: id + 1 };
          entries.push(entry);
        }
      }
      pdfInfo.entries = entries;
      await extractMeta(pdf, pdfInfo, directory, filepath, filename, emitter);
    } else {
      emitter.emit("info", {
        message:
          "Keine PDF Outline gefunden. Inhaltsverzeichnis kann nicht analysiert werden.",
      });
      pdfInfo.entries = [];
      await extractMeta(pdf, pdfInfo, directory, filepath, filename, emitter);
    }
  });
}
