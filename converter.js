const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const yazl = require("yazl");
const config = require("./config.json");

const pdfjs = require("pdfjs-dist/legacy/build/pdf");

function expandItems(items, result) {
  for (let item of items) {
    result.push(item);
    if (item.items) {
      expandItems(item.items, result);
    }
  }
}

module.exports.convertPDF = function (filepath) {
  const directory = path.dirname(filepath);
  const basename = path.basename(filepath);
  const filename = basename.substring(0, basename.lastIndexOf("."));
  pdfjs.disableWorker = true;
  if (!filepath.endsWith(".pdf")) {
    console.error("[convert] Not a PDF.");
    return;
  }
  const dataBuffer = fs.readFileSync(filepath);
  let pdfInfo = {};
  pdfjs.getDocument(dataBuffer).promise.then(async (pdf) => {
    pdfInfo.pages = pdf.numPages;
    pdfInfo.width = 0;
    pdfInfo.height = 0;
    for (let pageNum = 1; pageNum <= pdfInfo.pages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      pdfInfo.width = Math.max(pdfInfo.width, viewport.width);
      pdfInfo.height = Math.max(pdfInfo.height, viewport.height);
    }
    pdf.getOutline().then(async (outline) => {
      if (outline) {
        let items = [];
        expandItems(outline, items);
        let promises = [];
        for (let item of items) {
          const destination = item.dest;
          if (destination && typeof destination === "string") {
            const promise = pdf
              .getDestination(destination)
              .then(async (reference) => {
                const target = reference[0];
                return pdf.getPageIndex(target).then((id) => {
                  const entry = { title: item.title, page: parseInt(id) + 1 };
                  return entry;
                });
              })
              .catch(console.error);
            promises.push(promise);
          }
          if (
            destination &&
            typeof destination === "object" &&
            Array.isArray(destination)
          ) {
            const reference = destination[0];
            const promise = pdf
              .getPageIndex(reference)
              .then((id) => {
                const entry = { title: item.title, page: parseInt(id) + 1 };
                return entry;
              })
              .catch(console.error);
            promises.push(promise);
          }
        }
        Promise.all(promises).then(async (results) => {
          if (results) {
            pdfInfo.entries = results;
            const meta = await pdf.getMetadata().catch((error) => {
              return null;
            });
            if (meta && meta.info) {
              if (meta.info.Author) {
                pdfInfo.author = meta.info.Author;
              }
              if (meta.info.Title) {
                pdfInfo.title = meta.info.Title;
              }
            }
            const pagesDirectory = path.join(directory, "pages");
            if (!fs.existsSync(pagesDirectory)) {
              fs.mkdirSync(pagesDirectory, { recursive: true });
            }
            const pdf2svg = new Promise((resolve, reject) => {
              child_process.exec(
                `pdf2svg ${filepath} ${pagesDirectory}/${filename}-page-%03d.svg all`,
                (error, stdout, stderr) => {
                  if (error) {
                    reject(error);
                    return;
                  }
                  resolve({ stdout, stderr });
                }
              );
            });
            pdf2svg.then((stdout, stderr) => {
              if (stdout) console.log(stdout);
              if (stderr) console.error(stderr);
              pdfInfo.titles = [];
              for (const entry of pdfInfo.entries) {
                if (pdfInfo.titles[entry.page]) {
                  console.log(
                    "[pdf] Duplicate Bookmark Target:",
                    entry,
                    pdfInfo.titles[entry.page]
                  );
                  continue;
                } else {
                  pdfInfo.titles[entry.page] = entry.title;
                }
              }
              let mostRecentTitle = "Unknown Title";
              let mostRecentPageWithTitle = 1;
              for (let page = 1; page <= pdfInfo.pages; page++) {
                if (pdfInfo.titles[page]) {
                  mostRecentTitle = pdfInfo.titles[page];
                  mostRecentPageWithTitle = page;
                } else {
                  if (page === 1) {
                    pdfInfo.titles[page] = mostRecentTitle;
                  } else {
                    pdfInfo.titles[page - 1] =
                      mostRecentTitle + ` (${page - mostRecentPageWithTitle})`;
                    pdfInfo.titles[page] =
                      mostRecentTitle +
                      ` (${page - mostRecentPageWithTitle + 1})`;
                  }
                }
              }
              let deckerSource = "---\n";
              deckerSource += `title: ${
                pdfInfo.title ? pdfInfo.title : "Unknown Presentation Title"
              }\n`;
              deckerSource += `author: ${
                pdfInfo.author ? pdfInfo.author : "Unknown Author"
              }\n`;
              //deckerSource += `reveal:\n`;
              //deckerSource += `  width: ${data.width}\n`;
              //deckerSource += `  height: ${data.height}\n`;
              deckerSource += "---\n\n";
              for (let page = 1; page <= pdfInfo.pages; page++) {
                const pagenumber = String(page).padStart(3, "0");
                deckerSource += `# { menu-title="${pdfInfo.titles[page]}" }\n\n`;
                deckerSource += `![](pages/${filename}-page-${pagenumber}.svg){width=var(--slide-width) height=var(--slide-height)}\n\n`;
              }
              const yamlPath = path.join(directory, "decker.yaml");
              fs.writeFileSync(yamlPath, "resource-pack: exe:tudo\n");
              const mdPath = path.join(directory, filename + "-deck.md");
              fs.writeFile(mdPath, deckerSource, (error) => {
                if (error) console.error(error);
                let zipfile = new yazl.ZipFile();
                zipfile.addFile(mdPath, path.basename(mdPath));
                zipfile.addFile(yamlPath, path.basename(yamlPath));
                for (let page = 1; page <= pdfInfo.pages; page++) {
                  const pagenumber = String(page).padStart(3, "0");
                  const pagefilename = `${filename}-page-${pagenumber}.svg`;
                  const pagefile = path.join(pagesDirectory, pagefilename);
                  zipfile.addFile(pagefile, `pages/${pagefilename}`);
                }
                const zippath = path.join(directory, filename + ".zip");
                zipfile.outputStream
                  .pipe(fs.createWriteStream(zippath))
                  .on("close", function () {
                    console.log("[yazl] Written file:", zippath);
                    fs.rmSync(pagesDirectory, { recursive: true, force: true });
                    fs.rmSync(mdPath, { force: true });
                    fs.rmSync(yamlPath, { force: true });
                  });
                zipfile.end();
              });
            });
          }
        });
      }
    });
  });
};
