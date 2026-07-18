import { CompanyConfig } from "../config";
import { BaseScraper, ScrapeResult, closeBrowser } from "./base";
import { AmazonScraper } from "./amazon";
import { AmexScraper } from "./amex";
import { AppleScraper } from "./apple";
import { CapitalOneScraper } from "./capitalone";
import { GoogleCareersScraper } from "./googlecareers";
import { IBMScraper } from "./ibm";
import { JPMorganScraper } from "./jpmorgan";
import { MetaScraper } from "./meta";
import { MicrosoftScraper } from "./microsoft";
import { NikeScraper } from "./nike";
import { PhenomScraper } from "./phenom";
import { RobloxScraper } from "./roblox";
import { WorkdayScraper } from "./workday";
import { GenericScraper } from "./generic";

const registry: Record<string, new (c: CompanyConfig) => BaseScraper> = {
  googlecareers: GoogleCareersScraper,
  meta: MetaScraper,
  apple: AppleScraper,
  capitalone: CapitalOneScraper,
  jpmorgan: JPMorganScraper,
  roblox: RobloxScraper,
  microsoft: MicrosoftScraper,
  amazon: AmazonScraper,
  ibm: IBMScraper,
  phenom: PhenomScraper,
  amex: AmexScraper,
  workday: WorkdayScraper,
  nike: NikeScraper,
  generic: GenericScraper,
};

export function scrapeCompany(company: CompanyConfig): Promise<ScrapeResult> {
  const Cls = registry[company.scraper];
  if (!Cls) {
    throw new Error(`Unknown scraper "${company.scraper}" for ${company.name}`);
  }
  return new Cls(company).run();
}

export { closeBrowser };
