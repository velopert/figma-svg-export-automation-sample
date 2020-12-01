require('dotenv').config();
const axios = require('axios').default;
const fs = require('fs').promises;
const path = require('path');

const projectId = process.env.PROJECT_ID;
const assetsDir = path.resolve(__dirname, '../assets/');

const client = axios.create({
  headers: {
    'X-Figma-Token': process.env.FIGMA_TOKEN,
  },
});

async function sync() {
  const doc = await client.get(`https://api.figma.com/v1/files/${projectId}`);
  const { children } = doc.data.document.children[0].children[0];
  const icons = children.map((child) => ({ id: child.id, name: child.name }));
  const ids = icons.map((icon) => icon.id).join(',');
  const imageLinks = await client.get(
    `https://api.figma.com/v1/images/${projectId}/?ids=${ids}&format=svg`
  );
  const { images } = imageLinks.data;
  const iconsWithURL = icons.map((icon) => ({
    ...icon,
    url: images[icon.id],
  }));

  const maxConcurrentDownload = 20;
  let busy = 0;

  while (iconsWithURL.length > 0) {
    if (busy >= maxConcurrentDownload) {
      await sleep(10);
      continue;
    }

    busy += 1;
    const icon = iconsWithURL.pop();
    download(icon).then(() => {
      busy -= 1;
    });
  }
}

function replaceColor(svg) {
  return svg.replace(/fill=("black"|"#000000"|"#000")/g, 'fill="currentColor"');
}

async function download(icon) {
  console.log(`Downloading ${icon.name}`);
  const response = await axios.get(icon.url);
  const dir = path.join(assetsDir, `${icon.name}.svg`);
  return fs.writeFile(dir, replaceColor(response.data));
}

const sleep = (duration) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

sync();
