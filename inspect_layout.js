const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Emulate iPhone SE (375px width, 667px height)
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  
  console.log('Navigating to live site...');
  await page.goto('https://goodlife-fitness-salon.vercel.app/', { waitUntil: 'networkidle2' });

  // Add the red outline to main as requested by the user
  console.log('Adding outline to main element...');
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      main.style.outline = '2px solid red';
    }
  });

  // Extract layout info of all parent elements above the Add Entry button
  const layoutInfo = await page.evaluate(() => {
    const info = [];
    
    // Find the Add Entry button
    const buttons = Array.from(document.querySelectorAll('button'));
    const addButton = buttons.find(b => b.textContent.includes('Add Entry'));
    
    if (!addButton) {
      return { error: 'Add Entry button not found!' };
    }
    
    // Traverse parent elements
    let current = addButton;
    while (current) {
      const rect = current.getBoundingClientRect();
      const style = window.getComputedStyle(current);
      
      info.push({
        tagName: current.tagName,
        id: current.id,
        className: current.className,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right
        },
        styles: {
          display: style.display,
          position: style.position,
          height: style.height,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          flex: style.flex,
          flexGrow: style.flexGrow,
          flexShrink: style.flexShrink,
          flexBasis: style.flexBasis
        }
      });
      current = current.parentElement;
    }
    
    return { success: true, path: info };
  });

  console.log('\n--- DOM PATH & COMPUTED LAYOUT INFO ---');
  if (layoutInfo.error) {
    console.error(layoutInfo.error);
  } else {
    layoutInfo.path.forEach((el, index) => {
      console.log(`\n[Level ${index}] ${el.tagName}${el.id ? '#' + el.id : ''} (class: "${el.className}")`);
      console.log(`  - Rect size: ${el.rect.width.toFixed(1)}px x ${el.rect.height.toFixed(1)}px`);
      console.log(`  - display: ${el.styles.display}, position: ${el.styles.position}`);
      console.log(`  - height: ${el.styles.height}, min-height: ${el.styles.minHeight}, max-height: ${el.styles.maxHeight}`);
      console.log(`  - margin: ${el.styles.marginTop} (top), ${el.styles.marginBottom} (bottom)`);
      console.log(`  - padding: ${el.styles.paddingTop} (top), ${el.styles.paddingBottom} (bottom)`);
      console.log(`  - flex: ${el.styles.flex} (grow: ${el.styles.flexGrow}, shrink: ${el.styles.flexShrink}, basis: ${el.styles.flexBasis})`);
    });
  }

  await browser.close();
}

run().catch(console.error);
