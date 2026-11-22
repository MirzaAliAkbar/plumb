import { Link } from 'react-router-dom';
import { Page } from '../components/SiteChrome';
import '../styles/landing.css';

/**
 * The public page.
 *
 * It makes one argument: a PDF's stored order is not its reading order, the
 * difference is audible, and this tool closes it. Every claim below is either
 * checkable in the app or carries a named source.
 */
export function Landing() {
  return (
    <Page marketing>
      <section className="lede">
        <h1 className="lede__title">Fix the reading order of a PDF.</h1>
        <p className="lede__body">
          A screen reader follows the order the file stores. In a two-column paper that
          order jumps across the gutter, so it reads the first line of the left column,
          then the first line of the right, then back again. Plumb measures where the text
          actually sits, rebuilds the order a person would read, and exports semantic HTML
          you can keep.
        </p>
        <div className="lede__actions">
          <Link to="/app?sample=1" className="btn btn--primary btn--lg">
            Open the two-column sample
          </Link>
          <Link to="/app" className="btn btn--ghost btn--lg">
            Repair your own PDF
          </Link>
        </div>
        <p className="lede__assurance">
          Runs in your browser. Nothing is uploaded, and no account is needed to try it.
        </p>
      </section>

      <section className="demo" aria-labelledby="demo-heading">
        <h2 className="demo__heading" id="demo-heading">
          The whole problem, in one figure
        </h2>
        <div className="demo__pair">
          <figure className="demo__panel">
            <figcaption className="demo__caption">
              <span className="demo__tag demo__tag--bad">What the file stores</span>
              Line 1, then line 2 from the other column, then line 3. Every sentence
              interrupts the one before it.
            </figcaption>
            <div className="demo__page">
              <div className="demo__col">
                <span className="demo__line" data-n="1" />
                <span className="demo__line" data-n="3" />
                <span className="demo__line" data-n="5" />
              </div>
              <div className="demo__col">
                <span className="demo__line" data-n="2" />
                <span className="demo__line" data-n="4" />
                <span className="demo__line" data-n="6" />
              </div>
            </div>
          </figure>

          <figure className="demo__panel">
            <figcaption className="demo__caption">
              <span className="demo__tag demo__tag--good">What Plumb reads</span>
              Lines 1 to 3 finish the left column. Line 4 starts the right.
            </figcaption>
            <div className="demo__page">
              <div className="demo__col">
                <span className="demo__line" data-n="1" />
                <span className="demo__line" data-n="2" />
                <span className="demo__line" data-n="3" />
              </div>
              <div className="demo__col">
                <span className="demo__line" data-n="4" />
                <span className="demo__line" data-n="5" />
                <span className="demo__line" data-n="6" />
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="how__steps">
          <li className="how__step">
            <h3>Extract</h3>
            <p>
              pdf.js pulls out every text run with its exact position on the page. The file
              stays in the browser.
            </p>
          </li>
          <li className="how__step">
            <h3>Reconstruct</h3>
            <p>
              Runs are clustered into lines, and the gutter is found from a
              character-density profile across the page. A full-width title or caption
              splits the page into bands, so the order is left column then right column
              within each band.
            </p>
          </li>
          <li className="how__step">
            <h3>Show and export</h3>
            <p>
              A numbered overlay puts every block in order on top of the page, and a
              before/after view shows what moved. The export is semantic HTML with real{' '}
              <code>&lt;h2&gt;</code> and <code>&lt;p&gt;</code> elements.
            </p>
          </li>
        </ol>
      </section>

      <section className="why" id="why" aria-labelledby="why-heading">
        <h2 id="why-heading">Why it matters</h2>
        <div className="why__grid">
          <div className="why__point">
            <p className="why__stat">71.6%</p>
            <p className="why__note">
              of screen-reader users find information by jumping between headings. A PDF
              with no heading structure leaves them with no way to navigate.
            </p>
          </div>
          <div className="why__point">
            <p className="why__stat">21%</p>
            <p className="why__note">
              of US undergraduates report a disability, and about 8% register with their
              institution&rsquo;s disability office. Most of the rest never reach the office
              that provides licensed assistive software.
            </p>
          </div>
          <div className="why__point">
            <p className="why__stat">0</p>
            <p className="why__note">
              uploads, accounts, or keys needed to repair a document. The tool runs offline
              after the first load, so it works on a locked-down library machine.
            </p>
          </div>
        </div>
        <p className="why__sources">
          Sources: WebAIM Screen Reader User Survey #10; NCES; PNP Student Factsheet 2025.
        </p>
      </section>

      <section className="limits" aria-labelledby="limits-heading">
        <h2 id="limits-heading">What Plumb does not do</h2>
        <ul className="limits__list">
          <li>
            <strong>Scanned documents.</strong> There is no OCR. Plumb detects a scan and
            says so instead of returning garbage.
          </li>
          <li>
            <strong>Three-column layouts.</strong> One and two columns are handled.
          </li>
          <li>
            <strong>Complex tables.</strong> Their text is sequenced, not rebuilt as a
            table.
          </li>
          <li>
            <strong>Mathematics and right-to-left scripts.</strong> Neither is spoken
            correctly; use a dedicated tool for those.
          </li>
        </ul>
        <p className="limits__closing">
          Where the pipeline is unsure, it marks the block with a confidence figure so you
          can check that one instead of trusting the page.
        </p>
      </section>

      <section className="closing">
        <h2 className="closing__title">Try it on a document you already have.</h2>
        <p className="closing__body">
          It takes a few seconds, it works offline, and nothing leaves your device.
        </p>
        <Link to="/app" className="btn btn--primary btn--lg">
          Repair your own PDF
        </Link>
      </section>
    </Page>
  );
}
