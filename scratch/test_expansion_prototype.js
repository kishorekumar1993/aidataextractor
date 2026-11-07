function expandCompanyAbbreviations(name, country = "") {
  if (!name) return "";
  let n = name;

  // 1. Bracketed legal forms before stripping brackets: [Pty] Ltd, (Pty) Ltd, [Pte] Ltd, etc.
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]\s*ltd\.?/gi, "Proprietary Limited");
  n = n.replace(/\bpty\s*[\[\(]\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pty\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pte\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pvt\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]/gi, "Proprietary");

  // Handle (M) or [M] country identifier before Sdn Bhd (Rule 4: Remove brackets, preserve M / country name)
  n = n.replace(/[\[\(]\s*m\s*[\]\)]\s*(?=(?:sdn|sendirian|bhd|berhad|\b))/gi, " M ");
  n = n.replace(/[\[\(]\s*(malaysia)\s*[\]\)]/gi, " $1 ");

  // 2. Remove brackets from company name per Rule 4 (keep inner content, remove bracket symbols)
  n = n.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  n = n.replace(/[\(\)\[\]\{\}]/g, " ");

  // 3. Multi-word Latin American corporate entities (must run before simple S.A.)
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*b[\.\s]*de[\.\s]*c[\.\s]*v|sab\s+de\s+cv)\b\.?/gi, "Sociedad Anónima Bursátil de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*de[\.\s]*c[\.\s]*v|sa\s+de\s+cv)\b\.?/gi, "Sociedad Anónima de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*de[\.\s]*r[\.\s]*l[\.\s]*de[\.\s]*c[\.\s]*v|s\s+de\s+rl\s+de\s+cv)\b\.?/gi, "Sociedad de Responsabilidad Limitada de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*de[\.\s]*r[\.\s]*l|s\s+de\s+rl)\b\.?/gi, "Sociedad de Responsabilidad Limitada");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*p[\.\s]*i[\.\s]*de[\.\s]*c[\.\s]*v|sapi\s+de\s+cv)\b\.?/gi, "Sociedad Anónima Promotora de Inversión de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*c|sac)\b\.?$/gi, "Sociedad Anónima Cerrada");
  n = n.replace(/\b(?:e[\.\s]*i[\.\s]*r[\.\s]*l|eirl)\b\.?/gi, "Empresa Individual de Responsabilidad Limitada");
  n = n.replace(/\b(?:c[\.\s]*a|ca)\b\.?$/gi, "Compañía Anónima");

  // 4. Indonesia entities (prefix and suffix)
  n = n.replace(/(^|[\s,])(?:pt|p\.t\.)\b\.?\s+/gi, "$1Perseroan Terbatas ");
  n = n.replace(/\b(?:pt|p\.t\.)\b\.?$/gi, "Perseroan Terbatas");
  n = n.replace(/(^|[\s,])(?:cv|c\.v\.)\b\.?\s+/gi, "$1Commanditaire Vennootschap ");
  n = n.replace(/\b(?:cv|c\.v\.)\b\.?$/gi, "Commanditaire Vennootschap");
  n = n.replace(/(^|[\s,])(?:ud|u\.d\.)\b\.?\s+/gi, "$1Usaha Dagang ");
  n = n.replace(/\b(?:ud|u\.d\.)\b\.?$/gi, "Usaha Dagang");
  n = n.replace(/(^|[\s,])(?:pd|p\.d\.)\b\.?\s+/gi, "$1Perusahaan Daerah ");
  n = n.replace(/\b(?:tbk)\b\.?/gi, "Terbuka");

  // 5. Malaysia entities
  n = n.replace(/\bsdn[\.\s]+bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bsdn\s*bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bsdn\b\.?/gi, "Sendirian");
  n = n.replace(/\bbhd\b\.?/gi, "Berhad");
  n = n.replace(/\bplt\b\.?/gi, "Perkongsian Liabiliti Terhad");

  // 6. Germany / Austria / Switzerland (DACH)
  n = n.replace(/\bgmbh\s*(?:&|\+|und|and|u\.)\s*co\.?\s*kg\.?\b/gi, "Gesellschaft mit beschränkter Haftung and Compagnie Kommanditgesellschaft");
  n = n.replace(/\bgmbh\s*(?:&|\+|und|and|u\.)\s*co\.?\b/gi, "Gesellschaft mit beschränkter Haftung and Compagnie");
  n = n.replace(/\b(?:g[\.\s]*m[\.\s]*b[\.\s]*h|gmbh)\b\.?/gi, "Gesellschaft mit beschränkter Haftung");
  n = n.replace(/\b(?:u[\.\s]*g|ug)\s*(?:\(haftungsbeschr[äa]nkt\)|haftungsbeschr[äa]nkt)?\b\.?/gi, "Unternehmergesellschaft haftungsbeschränkt");
  n = n.replace(/\b(?:k[\.\s]*g[\.\s]*a[\.\s]*a|kgaa)\b\.?/gi, "Kommanditgesellschaft auf Aktien");
  n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?$/gi, "Aktiengesellschaft");
  n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?\s+(?=(?:und|and|co|kg)\b)/gi, "Aktiengesellschaft ");
  if (/germany|deutschland|austria|[öo]sterreich|switzerland|schweiz/i.test(country) || /\b(?:ag|a\.g\.)\b\.?$/i.test(n)) {
    n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?/gi, "Aktiengesellschaft");
  }
  n = n.replace(/\b(?:k[\.\s]*g|kg)\b\.?$/gi, "Kommanditgesellschaft");
  n = n.replace(/\b(?:o[\.\s]*h[\.\s]*g|ohg)\b\.?/gi, "Offene Handelsgesellschaft");
  n = n.replace(/\b(?:g[\.\s]*b[\.\s]*r|gbr)\b\.?/gi, "Gesellschaft bürgerlichen Rechts");
  n = n.replace(/\b(?:e[\.\s]*k|ek)\b\.?$/gi, "eingetragener Kaufmann");
  n = n.replace(/\b(?:e[\.\s]*v|ev)\b\.?$/gi, "eingetragener Verein");

  // 7. Italian entities
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l[\.\s]*s|srls)\b/gi, "Società a Responsabilità Limitata Semplificata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*a[\.\s]*r[\.\s]*l|scarl)\b/gi, "Società Cooperativa a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p[\.\s]*a|scpa)\b/gi, "Società Cooperativa per Azioni");
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l|srl)\b/gi, "Società a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*a|spa)\b/gi, "Società per Azioni");
  n = n.replace(/\b(?:s[\.\s]*n[\.\s]*c|snc)\b/gi, "Società in Nome Collettivo");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Società in Accomandita Semplice");
  n = n.replace(/\bs[\.\s]*s[\.\s]*\b/gi, "Società Semplice ");

  // 8. Spanish & Latin America entities
  n = n.replace(/\b(?:s[\.\s]*l[\.\s]*u\.?|slu)\b/gi, "Sociedad Limitada Unipersonal");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*u\.?|sau)\b/gi, "Sociedad Anónima Unipersonal");
  n = n.replace(/\b(?:s[\.\s]+l|s\.l\.?|sl)\b\.?/gi, "Sociedad Limitada");
  n = n.replace(/\b(?:s[\.\s]+a|s\.a\.?|sa)\b\.?/gi, "Sociedad Anónima");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p\.?|scp)\b/gi, "Sociedad Civil Privada");
  n = n.replace(/\b(?:s[\.\s]*coop\.?|scoop)\b/gi, "Sociedad Cooperativa");
  n = n.replace(/\b(?:l[\.\s]*t[\.\s]*d[\.\s]*a|ltda)\b\.?/gi, "Limitada");

  // 9. France & Belgium
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*r[\.\s]*l|sarl)\b/gi, "Société à Responsabilité Limitée");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s[\.\s]*u|sasu)\b/gi, "Société par Actions Simplifiée Unipersonnelle");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Société par Actions Simplifiée");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*r[\.\s]*l|sprl)\b/gi, "Société Privée à Responsabilité Limitée");
  n = n.replace(/\b(?:b[\.\s]*v[\.\s]*b[\.\s]*a|bvba)\b/gi, "Besloten Vennootschap met Beperkte Aansprakelijkheid");

  // 10. Netherlands & Belgium
  n = n.replace(/\b(?:b[\.\s]*v\.?|bv)\b/gi, "Besloten Vennootschap");
  n = n.replace(/\b(?:n[\.\s]*v\.?|nv)\b/gi, "Naamloze Vennootschap");
  n = n.replace(/\b(?:v[\.\s]*o[\.\s]*f\.?|vof)\b/gi, "Vennootschap onder Firma");

  // 11. Poland
  n = n.replace(/\b(?:sp\.?\s*z\s*o\.?\s*o\.?|sp[oó][lł]ka\s+z\s+o\.?o\.?)\b/gi, "Spółka z ograniczoną odpowiedzialnością");

  // 12. Eastern Europe & Russia (Joint Stock Companies)
  n = n.replace(/\b(?:p[\.\s]*j[\.\s]*s[\.\s]*c|pjsc)\b\.?/gi, "Public Joint Stock Company");
  n = n.replace(/\b(?:o[\.\s]*j[\.\s]*s[\.\s]*c|ojsc)\b\.?/gi, "Open Joint Stock Company");
  n = n.replace(/\b(?:c[\.\s]*j[\.\s]*s[\.\s]*c|cjsc)\b\.?/gi, "Closed Joint Stock Company");
  n = n.replace(/\b(?:j[\.\s]*s[\.\s]*c|jsc)\b\.?/gi, "Joint Stock Company");

  // 13. Czechia, Slovakia, Hungary, Balkans
  n = n.replace(/\b(?:spol\.?\s*s\s*r\.?o\.?|s[\.\s]*r[\.\s]*o\.?|sro)\b/gi, "společnost s ručením omezeným");
  n = n.replace(/\b(?:a[\.\s]*s\.?|akc\.?\s*spol\.?)\b(?!\s+(?:de\s+c\.?v\.?))/gi, "akciová společnost");
  n = n.replace(/\b(?:d[\.\s]*o[\.\s]*o\.?|doo)\b/gi, "društvo s ograničenom odgovornošću");
  n = n.replace(/\b(?:k[\.\s]*f[\.\s]*t\.?|kft)\b/gi, "Korlátolt Felelősségű Társaság");
  n = n.replace(/\b(?:z[\.\s]*r[\.\s]*t\.?|zrt)\b/gi, "Zártkörűen működő Részvénytársaság");
  n = n.replace(/\b(?:n[\.\s]*y[\.\s]*r[\.\s]*t\.?|nyrt)\b/gi, "Nyilvánosan működő Részvénytársaság");

  // 14. Nordics
  n = n.replace(/\b(?:aktiebolag|ab)\b\.?$/gi, "Aktiebolag");
  n = n.replace(/\b(?:aksjeselskap|as)\b\.?$/gi, "Aksjeselskap");
  n = n.replace(/\b(?:osakeyhti[oö]|oy)\b\.?$/gi, "Osakeyhtiö");
  n = n.replace(/\b(?:oyj)\b\.?$/gi, "Julkinen Osakeyhtiö");
  n = n.replace(/\b(?:anpartsselskab|aps)\b\.?$/gi, "Anpartsselskab");

  // 15. Australia & South Africa
  n = n.replace(/\bpty[\.\s]*ltd(?:\.|\b)/gi, "Proprietary Limited");
  n = n.replace(/\bpty(?:\.|\b)/gi, "Proprietary");

  // 16. Singapore, India, UK
  n = n.replace(/\bpte[\.\s]*ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpvt[\.\s]*ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpte(?:\.|\b)/gi, "Private");
  n = n.replace(/\bpvt(?:\.|\b)/gi, "Private");
  n = n.replace(/\bplc(?:\.|\b)/gi, "Public Limited Company");
  n = n.replace(/\bcic(?:\.|\b)/gi, "Community Interest Company");
  n = n.replace(/\bdac(?:\.|\b)/gi, "Designated Activity Company");

  // 17. Pan-European
  n = n.replace(/\b(?:s[\.\s]*e|se)\b\.?$/gi, "Societas Europaea");

  // 18. Common Business, Technical, and Industry Word Abbreviations in Company Names
  // Manufacturing / Makers
  n = n.replace(/\bmfg[\.\s]*co[\.\s]*,?[\.\s]*ltd(?:\.|\b)/gi, "Manufacturing Company, Limited");
  n = n.replace(/\bmfg(?:\.|\b)/gi, "Manufacturing");
  n = n.replace(/\bmfrs(?:\.|\b)/gi, "Manufacturers");
  n = n.replace(/\bmfr(?:\.|\b)/gi, "Manufacturer");

  // Industries / Industrial
  n = n.replace(/\bind[\.\s]*co[\.\s]*,?[\.\s]*ltd(?:\.|\b)/gi, "Industries Company, Limited");
  n = n.replace(/\bindust[\.\s]*co[\.\s]*,?[\.\s]*ltd(?:\.|\b)/gi, "Industries Company, Limited");
  n = n.replace(/\binds(?:\.|\b)/gi, "Industries");
  n = n.replace(/\bindust(?:\.|\b)/gi, "Industries");
  n = n.replace(/\bind\b\.?\s*(?=(?:services?|solutions?|suppl(?:y|ies)|products?|equipment|park|estate|zone|area)\b)/gi, "Industrial ");
  n = n.replace(/\bind(?:\.|\b)/gi, "Industries");

  // International / National
  n = n.replace(/\b(?:int['’]?l|intl)\b\.?/gi, "International");
  n = n.replace(/\b(?:nat['’]?l|natl)\b\.?/gi, "National");

  // Technology / Technologies
  n = n.replace(/\btechs(?:\.|\b)/gi, "Technologies");
  n = n.replace(/\b(?:technol|tech)\b\.?/gi, "Technology");

  // Engineering
  n = n.replace(/\b(?:engg|engr|eng)\b\.?\s*(?=(?:works|solutions?|services?|systems?|products?|co|company|corp|ltd|limited|inc|llc)\b)/gi, "Engineering ");
  n = n.replace(/\b(?:engg|engr)\b\.?/gi, "Engineering");

  // Equipment, Products, Systems, Development
  n = n.replace(/\b(?:eqpt|equip)\b\.?/gi, "Equipment");
  n = n.replace(/\bprods(?:\.|\b)/gi, "Products");
  n = n.replace(/\bprod(?:\.|\b)/gi, "Products");
  n = n.replace(/\b(?:syst|sys)\b\.?/gi, "Systems");
  n = n.replace(/\b(?:devel|dev)\b\.?/gi, "Development");

  // Services, Solutions, Associates, Group
  n = n.replace(/\b(?:svcs|svc|serv)\b\.?/gi, "Services");
  n = n.replace(/\b(?:solns|soln|sols)\b\.?/gi, "Solutions");
  n = n.replace(/\b(?:assocs|assoc)\b\.?/gi, "Associates");
  n = n.replace(/\bgrp\b\.?/gi, "Group");

  // Chemical, Electrical / Electronics, Automotive, Automation
  n = n.replace(/\bchems(?:\.|\b)/gi, "Chemicals");
  n = n.replace(/\bchem\b\.?\s*(?=(?:ind|industries|co|company|corp|ltd|limited|inc|llc|products?|supplies)\b)/gi, "Chemical ");
  n = n.replace(/\bchem(?:\.|\b)/gi, "Chemicals");
  n = n.replace(/\b(?:elect|elec)\b\.?\s*(?=(?:and|&|engineering|services?|supplies)\b)/gi, "Electrical ");
  n = n.replace(/\b(?:elect|elec)\b\.?/gi, "Electronics");
  n = n.replace(/\bauto\b\.?\s*(?=(?:parts?|components?|industr(?:y|ies)|vehicles?)\b)/gi, "Automotive ");
  n = n.replace(/\bauto\b\.?\s*(?=(?:systems?|solutions?|engineering)\b)/gi, "Automation ");

  // Distribution, Fabrication, Machinery, Packaging
  n = n.replace(/\b(?:distrib|dist)\b\.?\s*(?=(?:co|company|corp|ltd|limited|inc|llc|of)\b)/gi, "Distributors ");
  n = n.replace(/\b(?:distrib|dist)\b\.?/gi, "Distribution");
  n = n.replace(/\bfab\b\.?/gi, "Fabrication");
  n = n.replace(/\bmach\b\.?/gi, "Machinery");
  n = n.replace(/\b(?:pkg|pack)\b\.?/gi, "Packaging");

  // Management, Communications, Laboratories, Materials
  n = n.replace(/\b(?:mgmt|mgt)\b\.?/gi, "Management");
  n = n.replace(/\b(?:comms|comm)\b\.?/gi, "Communications");
  n = n.replace(/\b(?:labs|lab)\b\.?/gi, "Laboratories");
  n = n.replace(/\b(?:matl|mat)\b\.?/gi, "Materials");

  // Technical prefixes
  n = n.replace(/\bappl\b\.?\s*(?=(?:technol|tech|sciences?|systems?|materials?|engineering)\b)/gi, "Applied ");
  n = n.replace(/\badv\b\.?\s*(?=(?:technol|tech|materials?|systems?|engineering|solutions?)\b)/gi, "Advanced ");
  n = n.replace(/\bgen\b\.?\s*(?=(?:electric|motors?|trading|commercial|engineering|industries)\b)/gi, "General ");
  n = n.replace(/\bstd\b\.?\s*(?=(?:products?|engineering|parts?|fasteners?)\b)/gi, "Standard ");
  n = n.replace(/\b(?:envr|env)\b\.?\s*(?=(?:solutions?|services?|systems?|engineering)\b)/gi, "Environmental ");
  n = n.replace(/\b(?:transp|trans)\b\.?\s*(?=(?:solutions?|services?|systems?|logistics?)\b)/gi, "Transportation ");
  n = n.replace(/\b(?:logist|log)\b\.?\s*(?=(?:solutions?|services?|systems?)\b)/gi, "Logistics ");
  n = n.replace(/\b(?:constr|const)\b\.?\s*(?=(?:solutions?|services?|systems?|materials?|equipment|co|company|ltd|corp|inc)\b)/gi, "Construction ");
  n = n.replace(/\bpharm\b\.?/gi, "Pharmaceuticals");
  n = n.replace(/\btelecom\b\.?/gi, "Telecommunications");

  // 19. United States & Global Legal Entities (must run after Mfg/Ind compound rules)
  n = n.replace(/\bpllc(?:\.|\b)/gi, "Professional Limited Liability Company");
  n = n.replace(/\bllp(?:\.|\b)/gi, "Limited Liability Partnership");
  n = n.replace(/\bllc(?:\.|\b)/gi, "Limited Liability Company");
  n = n.replace(/\bl\.?l\.?c(?:\.|\b)/gi, "Limited Liability Company");
  n = n.replace(/\blp(?:\.|\b)/gi, "Limited Partnership");
  n = n.replace(/\bl\.?p(?:\.|\b)/gi, "Limited Partnership");

  // "Co., Ltd." variations (Taiwan, China, Japan, Korea, Global)
  n = n.replace(/\bco[\.\s]*,[\.\s]*ltd\b\.?/gi, "Company, Limited");
  n = n.replace(/\bco[\.\s]+ltd\b\.?/gi, "Company, Limited");
  n = n.replace(/\bCompany\s+Limited\b/gi, "Company, Limited");

  n = n.replace(/\bltd(?:\.|\b)/gi, "Limited");
  n = n.replace(/\bl\.?t\.?d(?:\.|\b)/gi, "Limited");
  n = n.replace(/\binc(?:\.|\b)/gi, "Incorporated");
  n = n.replace(/\bi\.?n\.?c(?:\.|\b)/gi, "Incorporated");
  n = n.replace(/\bcorp(?:\.|\b)/gi, "Corporation");
  n = n.replace(/\bc\.?o\.?r\.?p(?:\.|\b)/gi, "Corporation");
  n = n.replace(/\bco(?:\.|\b)/gi, "Company");
  n = n.replace(/\bc\.?o(?:\.|\b)/gi, "Company");

  // Clean semicolons and normalize commas without stripping dots and commas per Rule 4
  n = n.replace(/;+/g, " ");
  n = n.replace(/\s*,\s*/g, ", ");
  n = n.replace(/\s+/g, " ").trim();

  // Strip trailing dot if attached directly to corporate suffix (e.g. "Limited." -> "Limited", "Incorporated." -> "Incorporated")
  n = n.replace(/\b(Company,\s*Limited|Limited|Incorporated|Corporation|Company|Proprietary\s*Limited|Private\s*Limited|Sendirian\s*Berhad|Berhad|Aktiengesellschaft|Gesellschaft\s*mit\s*beschränkter\s*Haftung|Sociedad\s*Anónima|Sociedad\s*Limitada|Società\s*per\s*Azioni|Società\s*a\s*Responsabilità\s*Limitata|Société\s*Anonyme|Société\s*à\s*Responsabilité\s*Limitée|Limitada)\.+$/gi, "$1");

  return n;
}

const testCases = [
  "Kaulin Mfg. Co., Ltd.",
  "Acme Ind. Co., Ltd.",
  "ABC Intl. Corp.",
  "Apex Engg. Works Ltd.",
  "Global Tech. Inc.",
  "National Fire Equip. Ltd.",
  "General Prod. Co.",
  "Business Solns. Inc.",
  "Industrial Svcs. Ltd.",
  "Precision Mach. Co.",
  "Creative Pkg. Ltd.",
  "Advanced Chem. Corp.",
  "Modern Elec. Ind.",
  "Smith & Assoc.",
  "Kaulin Grp.",
  "Kaulin Mfg Co Ltd",
  "Kaulin Mfg. Co. Ltd.",
  "Kaulin CO.,LTD.",
  "U.S. Tsubaki Ind., LLC",
  "Carrier Corp.",
  "Furco (Taiwan) Co., Ltd.",
  "Nikorex Display Products (M) Sdn. Bhd.",
  "Danzer UK Ltd.",
  "Siemens AG",
  "Bosch GmbH",
  "Schneider Electric SA",
  "TotalEnergies SE",
  "Petrobras S.A.",
  "Vale S.A.",
  "Ambev S.A.",
  "Cemex S.A.B. de C.V.",
  "FEMSA S.A. de C.V.",
  "Embraer S.A.",
  "JSC Russian Railways",
  "PJSC Gazprom"
];

console.log("=== Testing New Prototype expandCompanyAbbreviations ===");
testCases.forEach(name => {
  const expanded = expandCompanyAbbreviations(name);
  console.log(`${name}  ===>  ${expanded}`);
});

