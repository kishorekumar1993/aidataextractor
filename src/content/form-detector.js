// Data-entry portal form element detection, smart dropdown matching, and field population.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {});

  function isDataEntryPage() {
    return !!(
      document.getElementById("inputWebsiteName") ||
      document.getElementById("website-name") ||
      document.getElementById("btnLoadNextQueueUrl") ||
      document.getElementById("selectWebsiteStatus") ||
      document.getElementById("website-status") ||
      document.getElementById("btnClickHere") ||
      document.querySelector("input[id*='Website'], select[id*='WebsiteStatus'], [id*='inputWebsite']") ||
      (window.location.href && window.location.href.includes("dataextraction"))
    );
  }


  /**
   * Specifically finds the "Website Name:" input element.
   */
  function findWebsiteNameInput() {
    // 1. Direct ID lookup for https://kishorekumar1993.github.io/dataextraction/
    const exact = document.getElementById("inputWebsiteName") || document.getElementById("website-name");
    if (exact) return exact;

    // 2. Look for button with id btnClickHere or text "click here"
    const clickHereBtn = document.getElementById("btnClickHere") ||
      Array.from(document.querySelectorAll("button, a, input[type=button]")).find(b => (b.textContent || b.value || "").toLowerCase().includes("click here"));

    if (clickHereBtn) {
      const container = clickHereBtn.closest(".website-input-group, .input-row, .form-group, div, td, tr");
      if (container) {
        const inputInGroup = container.querySelector("input[type=text], input[type=url], input:not([type=button]):not([type=submit])");
        if (inputInGroup) return inputInGroup;
      }
      if (clickHereBtn.previousElementSibling && clickHereBtn.previousElementSibling.tagName === "INPUT") {
        return clickHereBtn.previousElementSibling;
      }
    }

    // 3. Search by label
    const labels = Array.from(document.querySelectorAll("label, span, div, p"));
    for (const lbl of labels) {
      const text = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
      if (text.startsWith("website name") || text.includes("website name:")) {
        if (lbl.htmlFor) {
          const el = document.getElementById(lbl.htmlFor);
          if (el) return el;
        }
        const parent = lbl.closest(".form-group, .col, div");
        if (parent) {
          const input = parent.querySelector("input");
          if (input) return input;
        }
      }
    }

    // 4. Any input starting with http
    const allInputs = Array.from(document.querySelectorAll("input"));
    for (const input of allInputs) {
      if (input.type === "hidden" || input.type === "submit" || input.type === "button") continue;
      const val = (input.value || "").trim().toLowerCase();
      if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("www.")) {
        return input;
      }
    }

    return document.querySelector("input[name*='website'], input[id*='website'], input[name*='url'], input[id*='url']");
  }

  function getTargetUrl() {
    const input = findWebsiteNameInput();
    if (input && input.value) {
      return input.value.trim();
    }
    return "";
  }

  function getElementContext(el) {
    if (!el) return "";
    let ctx = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""}`.toLowerCase();
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) ctx += " " + (lbl.textContent || "").toLowerCase();
    }
    let prev = el.previousElementSibling;
    if (prev) {
      ctx += " " + (prev.textContent || "").toLowerCase();
    }
    if (el.parentElement) {
      const parentLabel = el.parentElement.querySelector("label");
      if (parentLabel && parentLabel !== el) {
        ctx += " " + (parentLabel.textContent || "").toLowerCase();
      }
    }
    return ctx;
  }

  /**
   * Discovers and maps page form elements with direct ID matching and robust fallback.
   */
  function detectFormElements() {
    const elements = {};

    // 1. Direct ID mappings matching https://kishorekumar1993.github.io/dataextraction/ & test replica
    elements.websiteUrl = document.getElementById("inputWebsiteName") || document.getElementById("website-name") || findWebsiteNameInput();
    elements.websiteStatus = document.getElementById("selectWebsiteStatus") ||
      document.getElementById("website-status") ||
      document.querySelector("select[name*='status']") ||
      document.querySelector("select[id*='status']") ||
      document.querySelector("select[name*='website_status']");

    if (!elements.websiteStatus) {
      const allSelects = Array.from(document.querySelectorAll("select"));
      elements.websiteStatus = allSelects.find(s =>
        Array.from(s.options).some(o => (o.text || o.value || "").trim().toLowerCase() === "not working")
      ) || allSelects.find(s => {
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("website status") || getElementContext(s).includes("website status");
      }) || allSelects[0];
    }
    elements.businessType = document.getElementById("selectBusinessType") || document.getElementById("business-type");
    elements.companyProfile = document.getElementById("selectCompanyProfile") || document.getElementById("company-profile");
    elements.companyName = document.getElementById("inputCompanyName") || document.getElementById("company-name");
    elements.companyAddress = document.getElementById("inputCompanyAddress") || document.getElementById("company-address");
    elements.countryName = document.getElementById("inputCountry") || document.getElementById("country-name");
    elements.state = document.getElementById("selectState") || document.getElementById("state");
    elements.city = document.getElementById("selectCity") || document.getElementById("city");
    elements.emailId = document.getElementById("inputEmail") || document.getElementById("email-id") || document.getElementById("email") || document.getElementById("primaryEmail");
    elements.secondaryEmailId = document.getElementById("inputSecondaryEmail") || document.getElementById("secondary-email-id") || document.getElementById("secondaryEmail") || document.getElementById("secondary_email") || document.getElementById("altEmail") || document.getElementById("alternateEmail");
    elements.phoneNumber = document.getElementById("inputPhone") ||
      document.getElementById("phone-number") ||
      document.getElementById("phone") ||
      document.getElementById("phoneNumber") ||
      document.getElementById("inputPhoneNumber") ||
      document.getElementById("telephone") ||
      document.getElementById("inputTelephone") ||
      document.querySelector('input[type="tel"]') ||
      document.querySelector('input[name="phoneNumber"]') ||
      document.querySelector('input[name="phone"]') ||
      document.querySelector('input[name="inputPhone"]') ||
      document.querySelector('input[name="telephone"]');
    elements.numberOfProducts = document.getElementById("selectProductCount") || document.getElementById("number-of-product");
    elements.productImages = document.getElementById("selectProductImage") || document.getElementById("image-product");
    elements.numberOfProductDescriptions = document.getElementById("selectProductDescription") || document.getElementById("desc-of-product");

    // Fallback detection for any generic portal
    const allInputs = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])")).filter(i => i !== elements.websiteUrl);
    const allSelects = Array.from(document.querySelectorAll("select"));
    const allTextareas = Array.from(document.querySelectorAll("textarea"));

    if (!elements.websiteStatus) {
      elements.websiteStatus = allSelects.find(s => {
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("website status") || getElementContext(s).includes("website status");
      }) || allSelects[0];
    }

    if (!elements.businessType) {
      elements.businessType = allSelects.find(s => {
        if (s === elements.websiteStatus) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("kind of business") || firstOpt.includes("business type") || getElementContext(s).includes("business type");
      }) || allSelects[1];
    }

    if (!elements.companyProfile) {
      elements.companyProfile = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("company profile") || getElementContext(s).includes("company profile");
      }) || allSelects[2];
    }

    if (!elements.companyName) {
      elements.companyName = allInputs.find(inp => {
        const ph = (inp.placeholder || "").toLowerCase();
        return ph.includes("company name") || getElementContext(inp).includes("company name");
      });
    }

    if (!elements.companyAddress) {
      elements.companyAddress = allTextareas.find(ta => {
        return (ta.placeholder || "").toLowerCase().includes("address") || getElementContext(ta).includes("address");
      }) || allInputs.find(inp => {
        return inp !== elements.companyName && (inp.placeholder || "").toLowerCase().includes("address");
      });
    }

    if (!elements.countryName) {
      elements.countryName = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress) return false;
        const ph = (inp.placeholder || "").toLowerCase().trim();
        return ph === "country" || ph.includes("country") || getElementContext(inp).includes("country");
      });
    }

    if (!elements.state) {
      elements.state = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt === "state" || getElementContext(s).includes("state:");
      });
    }

    if (!elements.city) {
      elements.city = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt === "city" || getElementContext(s).includes("city:");
      });
    }

    if (!elements.emailId) {
      elements.emailId = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName) return false;
        const ctx = getElementContext(inp);
        return !ctx.includes("secondary") && (ctx.includes("email") || (inp.placeholder || "").toLowerCase().includes("email id"));
      });
    }

    if (!elements.secondaryEmailId) {
      elements.secondaryEmailId = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName || inp === elements.emailId) return false;
        const ctx = getElementContext(inp);
        return ctx.includes("secondary") || ctx.includes("alternate") || ctx.includes("alt email") || ctx.includes("email 2") || ctx.includes("email2") || ctx.includes("additional email") || (inp.placeholder || "").toLowerCase().includes("secondary") || (inp.placeholder || "").toLowerCase().includes("alternate");
      });
    }

    if (!elements.phoneNumber) {
      elements.phoneNumber = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName || inp === elements.emailId || inp === elements.secondaryEmailId) return false;
        const ctx = getElementContext(inp);
        return ctx.includes("phone") || ctx.includes("mobile") || ctx.includes("tel") || (inp.placeholder || "").toLowerCase().includes("phone") || inp.type === "tel";
      });
    }

    if (!elements.numberOfProducts) {
      elements.numberOfProducts = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("number of product") || getElementContext(s).includes("number of product");
      });
    }

    if (!elements.productImages) {
      elements.productImages = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city || s === elements.numberOfProducts) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("image of product") || firstOpt.includes("image product") || getElementContext(s).includes("image product");
      });
    }

    if (!elements.numberOfProductDescriptions) {
      elements.numberOfProductDescriptions = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city || s === elements.numberOfProducts || s === elements.productImages) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("desc of product") || firstOpt.includes("product description") || getElementContext(s).includes("product description");
      });
    }

    return elements;
  }

  function setInputValue(element, val) {
    if (!element) return false;
    const value = val !== undefined && val !== null ? String(val) : "";

    try {
      const isTextarea = element.tagName && element.tagName.toLowerCase() === "textarea";
      const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
    } catch (e) {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  /**
   * Sets dropdown option matching both textual ("Three", "One", "Available") and numeric ("3", "1", "0") options!
   */
  function setSelectValue(element, targetValue) {
    if (!element) return false;
    const targetClean = String(targetValue).trim().toLowerCase();

    const isZero = targetClean === "0" || targetClean === "zero";
    const isOne = targetClean === "one" || targetClean === "1";
    const isTwo = targetClean === "two" || targetClean === "2";
    const isThree = targetClean === "three" || targetClean === "3";
    const isAvailable = targetClean === "available";
    const isNotAvailable = targetClean === "not available";

    if (element.tagName && element.tagName.toLowerCase() === "select") {
      let matchedIndex = -1;

      // 1. Direct text/value match
      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        const val = (opt.value || "").trim().toLowerCase();
        const txt = (opt.text || "").trim().toLowerCase();

        if (val === targetClean || txt === targetClean) {
          matchedIndex = i;
          break;
        }
      }

      // 1b. Redirect Site alias matching (supports "Redirect Site", "Redirect", etc.)
      if (matchedIndex === -1 && targetClean.includes("redirect")) {
        for (let i = 0; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();
          if (val === "redirect site" || txt === "redirect site" || val === "redirect" || txt === "redirect" || txt.includes("redirect") || val.includes("redirect")) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 2. Symbolic & Numeric mapping (Supports 0, 1, 2, 3 options as in https://kishorekumar1993.github.io/dataextraction/)
      if (matchedIndex === -1) {
        for (let i = 0; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();

          if (isZero && (val === "0" || txt === "0")) {
            matchedIndex = i;
            break;
          }
          if (isThree && (val === "3" || txt === "3" || val === "three" || txt.includes("three"))) {
            matchedIndex = i;
            break;
          }
          if (isOne && (val === "1" || txt === "1" || val === "one" || txt.includes("one"))) {
            matchedIndex = i;
            break;
          }
          if (isTwo && (val === "2" || txt === "2" || val === "two" || txt.includes("two"))) {
            matchedIndex = i;
            break;
          }
          if (isAvailable && (val === "available" || txt === "available" || (txt.includes("available") && !txt.includes("not")))) {
            matchedIndex = i;
            break;
          }
          if (isNotAvailable && (val === "not available" || txt === "not available" || txt.includes("not available") || (txt.includes("not") && txt.includes("avail")))) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 3. Substring match (skip placeholder option 0 if multiple options exist)
      if (matchedIndex === -1 && element.options.length > 1) {
        for (let i = 1; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();

          if (isAvailable) {
            if ((val.includes("available") || txt.includes("available")) && !val.includes("not") && !txt.includes("not")) {
              matchedIndex = i;
              break;
            }
          } else if (isNotAvailable) {
            if (val.includes("not available") || txt.includes("not available") || (txt.includes("not") && txt.includes("avail"))) {
              matchedIndex = i;
              break;
            }
          } else if (val.includes(targetClean) || txt.includes(targetClean)) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 4. Country alias fallbacks (Czechia <-> Czech Republic, Turkiye <-> Turkey, NZ <-> New Zealand, etc.)
      if (matchedIndex === -1) {
        if (targetClean === "czechia" || targetClean === "czech republic" || targetClean === "czech") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "czechia" || txt === "czechia" || val === "czech republic" || txt === "czech republic" || val === "ceska republika" || txt === "ceska republika" || val === "česká republika" || txt === "česká republika" || val === "czech" || txt === "czech") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "eswatini" || targetClean === "swaziland") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "eswatini" || txt === "eswatini" || val === "swaziland" || txt === "swaziland") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "myanmar" || targetClean === "burma") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "myanmar" || txt === "myanmar" || val === "burma" || txt === "burma") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "north macedonia" || targetClean === "macedonia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "north macedonia" || txt === "north macedonia" || val === "macedonia" || txt === "macedonia" || val === "fyrom" || txt === "fyrom") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "netherlands" || targetClean === "holland") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "netherlands" || txt === "netherlands" || val === "holland" || txt === "holland" || val === "the netherlands" || txt === "the netherlands") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "cote d'ivoire" || targetClean === "côte d'ivoire" || targetClean === "ivory coast") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val.includes("cote d'ivoire") || txt.includes("cote d'ivoire") || val.includes("côte d'ivoire") || txt.includes("côte d'ivoire") || val.includes("ivory coast") || txt.includes("ivory coast")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "timor-leste" || targetClean === "east timor") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "timor-leste" || txt === "timor-leste" || val === "east timor" || txt === "east timor") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "cabo verde" || targetClean === "cape verde") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "cabo verde" || txt === "cabo verde" || val === "cape verde" || txt === "cape verde") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "vietnam" || targetClean === "viet nam") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "vietnam" || txt === "vietnam" || val === "viet nam" || txt === "viet nam") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "south korea" || targetClean === "korea") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "south korea" || txt === "south korea" || val.includes("republic of korea") || txt.includes("republic of korea") || val === "korea, republic of" || txt === "korea, republic of" || val === "korea" || txt === "korea") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "turkiye" || targetClean === "türkiye") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "turkey" || txt === "turkey" || val === "turkiye" || txt === "turkiye" || val === "türkiye" || txt === "türkiye") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "turkey") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "turkiye" || txt === "turkiye" || val === "türkiye" || txt === "türkiye") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "new zealand") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "nz" || txt === "nz" || val === "nzl" || txt === "nzl" || val === "new zealand" || txt === "new zealand" || val.includes("new zealand") || txt.includes("new zealand")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "malaysia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "my" || txt === "my" || val === "mys" || txt === "mys" || val === "malaysia" || txt === "malaysia" || val.includes("malaysia") || txt.includes("malaysia")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "indonesia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "id" || txt === "id" || val === "idn" || txt === "idn" || val === "indonesia" || txt === "indonesia" || val.includes("indonesia") || txt.includes("indonesia") || val.includes("republik indonesia") || txt.includes("republik indonesia")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "united states of america" || targetClean === "united states") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "usa" || txt === "usa" || val === "us" || txt === "us" || val === "united states" || txt === "united states" || val === "united states of america" || txt === "united states of america") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "united kingdom" || targetClean === "uk" || targetClean === "great britain") {
          // Pass 1: exact match for United Kingdom, UK, or Great Britain
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "united kingdom" || txt === "united kingdom" || val === "uk" || txt === "uk" || val === "great britain" || txt === "great britain") {
              matchedIndex = i;
              break;
            }
          }
          // Pass 2: fall back to England only if United Kingdom is not in the dropdown
          if (matchedIndex === -1) {
            for (let i = 0; i < element.options.length; i++) {
              const opt = element.options[i];
              const val = (opt.value || "").trim().toLowerCase();
              const txt = (opt.text || "").trim().toLowerCase();
              if (val === "england" || txt === "england") {
                matchedIndex = i;
                break;
              }
            }
          }
        } else if (targetClean === "england" || targetClean === "scotland" || targetClean === "wales" || targetClean === "northern ireland") {
          // Pass 1: exact match for specific constituent country (England, Scotland, Wales, Northern Ireland)
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === targetClean || txt === targetClean) {
              matchedIndex = i;
              break;
            }
          }
          // Pass 2: fall back to United Kingdom only if specific constituent is not in the dropdown
          if (matchedIndex === -1) {
            for (let i = 0; i < element.options.length; i++) {
              const opt = element.options[i];
              const val = (opt.value || "").trim().toLowerCase();
              const txt = (opt.text || "").trim().toLowerCase();
              if (val === "united kingdom" || txt === "united kingdom" || val === "uk" || txt === "uk" || val === "great britain" || txt === "great britain") {
                matchedIndex = i;
                break;
              }
            }
          }
        } else if (targetClean === "distributer" || targetClean === "distributor") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "distributer" || txt === "distributer" || val === "distributor" || txt === "distributor") {
              matchedIndex = i;
              break;
            }
          }
        }
      }

      if (matchedIndex !== -1) {
        element.selectedIndex = matchedIndex;
        try {
          element.value = element.options[matchedIndex].value;
        } catch (e) { }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function highlightField(element) {
    if (!element) return;
    element.classList.add("ai-prefilled-field");
    element.style.transition = "background-color 0.4s ease, border-color 0.4s ease";
    element.style.backgroundColor = "#ecfdf5";
    element.style.borderColor = "#10b981";

    setTimeout(() => {
      element.style.backgroundColor = "";
      element.style.borderColor = "";
    }, 2500);
  }


  function fillFormFields(data) {
    if (!data) return { filledCount: 0 };
    const elements = detectFormElements();
    clearFilledFields({ silent: true }); // Reset all form fields to prevent ghost bleed-through from previous record
    let filledCount = 0;

    const allowedWorkingTypes = new Set([
      "manufacturer",
      "manufacturing",
      "manufacture",
      "industrial services",
      "industrial service",
      "exporter",
      "export",
      "trader",
      "trading",
      "distributer",
      "distributor",
      "distribution",
      "supplier",
      "supplies",
      "wholesaler",
      "wholesale"
    ]);

    const btVal = String(data.businessType || "").trim().toLowerCase();
    const isDisallowedType = !!(btVal && !allowedWorkingTypes.has(btVal));

    const isProhibitedOrRestricted = !data._isFromAi && !!(data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site" || isDisallowedType || data.isDisallowedBusinessType);

    // Rule 1 QC Safeguard: A site with 0 products and no address or contact info CANNOT be Working!
    const isZeroProdUnverifiable = !data._isFromAi && (String(data.numberOfProducts || "").trim() === "0" || data.numberOfProducts === 0) &&
      (!data.companyAddress || data.companyAddress === "Not Available" || !data.companyAddress.trim()) &&
      (!data.emailId || !data.emailId.trim()) &&
      (!data.phoneNumber || !data.phoneNumber.trim());

    // CRITICAL QC RULE:
    // When Website Status is NOT "Working" and NOT "Redirect Site" (Not Working, Non English, Flash, Domain Expired, or prohibited category detected),
    // select the respective status and clear/leave empty ALL other fields!
    // NOTE: "Redirect Site" is a WORKING website that redirected to a new domain (Rule 13).
    // All 14 fields MUST be filled with the company data from the final redirected URL!
    const isNonWorkingStatus = (data.websiteStatus &&
      data.websiteStatus !== "Working" &&
      data.websiteStatus !== "Redirect Site" &&
      data.websiteStatus !== "Redirect") || isZeroProdUnverifiable;
    if (isNonWorkingStatus || isProhibitedOrRestricted) {
      const targetStatus = (isProhibitedOrRestricted || isZeroProdUnverifiable) ? "Not Working" : (data.websiteStatus || "Not Working");
      if (elements.websiteStatus) {
        if (setSelectValue(elements.websiteStatus, targetStatus)) {
          highlightField(elements.websiteStatus);
          filledCount++;
        }
      }

      // Display detailed Not Working Study Card & reason
      if (targetStatus === "Not Working" || isNonWorkingStatus) {
        state.currentNotWorkingData = data;
        AIExt.showNotWorkingStudyCard(data);
      }

      // Check auto-submit toggle: Only auto-submit if user enabled it!
      if (targetStatus === "Not Working") {
        const currentUrl = getTargetUrl();
        if (state.autoSubmitNotWorkingEnabled) {
          AIExt.updateStatus("⚠️ Status set to Not Working. Auto-submitting in 3s... (Click 'Stop Auto-Submit' to study)", "warning");
          if (state.pendingAutoSubmitTimer) clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = setTimeout(() => {
            state.pendingAutoSubmitTimer = null;
            AIExt.autoSubmitNotWorking(currentUrl);
          }, 3000);
        } else {
          // Auto-submit is OFF so user can review and study
          if (state.pendingAutoSubmitTimer) {
            clearTimeout(state.pendingAutoSubmitTimer);
            state.pendingAutoSubmitTimer = null;
          }
          const studyInfo = AIExt.extractNotWorkingReason(data);
          AIExt.updateStatus(`🚫 NOT WORKING: ${studyInfo.reason}. Auto-submit is STOPPED so you can study.`, "error");
        }
      }

      // Clear all other fields (leave empty string / default placeholder)
      for (const [key, el] of Object.entries(elements)) {
        if (!el || key === "websiteUrl" || key === "websiteStatus") continue;
        if (el.tagName && el.tagName.toLowerCase() === "select") {
          el.selectedIndex = 0;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          setInputValue(el, "");
        }
        el.classList.remove("ai-prefilled-field");
      }

      if (isProhibitedOrRestricted) {
        AIExt.showRestrictedBanner(data.restrictedReason || "Prohibited Category Detected");
      }

      return { filledCount, isNotWorking: true, isRestricted: isProhibitedOrRestricted };
    }

    // 1. Website Status
    try {
      if (elements.websiteStatus && data.websiteStatus) {
        if (setSelectValue(elements.websiteStatus, data.websiteStatus)) {
          highlightField(elements.websiteStatus);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting websiteStatus:", e); }

    // 2. Business Type
    try {
      if (elements.businessType && data.businessType) {
        if (setSelectValue(elements.businessType, data.businessType)) {
          highlightField(elements.businessType);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting businessType:", e); }

    // 3. Company Profile
    try {
      if (elements.companyProfile && data.companyProfile) {
        if (setSelectValue(elements.companyProfile, data.companyProfile)) {
          highlightField(elements.companyProfile);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyProfile:", e); }

    // 4. Company Name (Rule: All words start with Capital letter, Special character should not start and should not end)
    try {
      if (elements.companyName && data.companyName) {
        let formattedName = String(data.companyName).trim();
        // Rule: Special character should not start and should not end
        formattedName = formattedName.replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N}]+$/gu, "").trim();
        if (setInputValue(elements.companyName, formattedName)) {
          highlightField(elements.companyName);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyName:", e); }

    // 5. Country Name (Rule: Full official country name in Title Case)
    try {
      if (elements.countryName && data.countryName) {
        let formattedCountry = String(data.countryName).trim();
        const isSelect = elements.countryName.tagName && elements.countryName.tagName.toLowerCase() === "select";
        const success = isSelect ? setSelectValue(elements.countryName, formattedCountry) : setInputValue(elements.countryName, formattedCountry);
        if (success) {
          highlightField(elements.countryName);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting countryName:", e); }

    // 6. Company Address (Trust background.js final QC-sanitized address directly)
    try {
      const addrVal = (data.companyAddress && data.companyAddress !== "Not Available")
        ? String(data.companyAddress).trim()
        : "";
      if (elements.companyAddress && addrVal) {
        if (setInputValue(elements.companyAddress, addrVal)) {
          highlightField(elements.companyAddress);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyAddress:", e); }

    // 7. State
    try {
      if (elements.state && data.state) {
        if (setSelectValue(elements.state, data.state)) {
          highlightField(elements.state);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting state:", e); }

    // 8. City
    try {
      if (elements.city && data.city) {
        if (setSelectValue(elements.city, data.city)) {
          highlightField(elements.city);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting city:", e); }

    // 9. Email ID
    try {
      if (elements.emailId) {
        let cleanEmail = data.emailId ? stripTrailingContactWordsFromEmail(String(data.emailId).trim()) : "";
        setInputValue(elements.emailId, cleanEmail);
        if (cleanEmail) {
          highlightField(elements.emailId);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting emailId:", e); }

    // 10. Secondary Email ID (QC Rule: primary and secondary emails MUST NOT be the same)
    try {
      if (elements.secondaryEmailId) {
        try { elements.secondaryEmailId.setAttribute("autocomplete", "off"); } catch (e) { }
        let secEmail = data.secondaryEmailId ? stripTrailingContactWordsFromEmail(String(data.secondaryEmailId || "").trim()) : "";
        const primEmail = data.emailId ? stripTrailingContactWordsFromEmail(String(data.emailId || "").trim()).toLowerCase() : "";
        if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test(secEmail) || secEmail.toLowerCase() === primEmail) {
          secEmail = "";
        }
        setInputValue(elements.secondaryEmailId, secEmail);
        if (secEmail) {
          highlightField(elements.secondaryEmailId);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting secondaryEmailId:", e); }

    // 11. Phone Number (Digits only, country code and leading zeroes stripped)
    try {
      if (elements.phoneNumber) {
        let phoneVal = (data.phoneNumber && data.phoneNumber !== "Not Available") ? String(data.phoneNumber).trim() : "";
        setInputValue(elements.phoneNumber, phoneVal);
        if (phoneVal) {
          highlightField(elements.phoneNumber);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting phoneNumber:", e); }

    // 12, 13, 14. Independent Product Metrics (Evaluated independently per website evidence)
    const parseCountStr = (v) => {
      if (!v) return "0";
      const s = String(v).trim().toLowerCase();
      if (s === "three" || s === "3") return "3";
      if (s === "two" || s === "2") return "2";
      if (s === "one" || s === "1") return "1";
      const n = parseInt(s, 10);
      return (!isNaN(n) && n > 0) ? (n >= 3 ? "3" : String(n)) : "0";
    };

    const hasCountVal = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const imageCount = parseCountStr(data.productImages);
    const prodCount = hasCountVal(data.numberOfProducts) ? parseCountStr(data.numberOfProducts) : imageCount;
    const descCount = hasCountVal(data.numberOfProductDescriptions) ? parseCountStr(data.numberOfProductDescriptions) : imageCount;

    // 12. Number of Products
    try {
      if (elements.numberOfProducts) {
        if (setSelectValue(elements.numberOfProducts, prodCount)) {
          highlightField(elements.numberOfProducts);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting numberOfProducts:", e); }

    // 13. Product Images
    try {
      if (elements.productImages) {
        if (setSelectValue(elements.productImages, imageCount)) {
          highlightField(elements.productImages);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting productImages:", e); }

    // 14. Number of Product Descriptions
    try {
      if (elements.numberOfProductDescriptions) {
        if (setSelectValue(elements.numberOfProductDescriptions, descCount)) {
          highlightField(elements.numberOfProductDescriptions);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting numberOfProductDescriptions:", e); }

    return { filledCount };
  }

  function clearFilledFields(options = {}) {
    const elements = detectFormElements();
    for (const [key, el] of Object.entries(elements)) {
      if (!el || key === "websiteUrl") continue;
      if (el.tagName && el.tagName.toLowerCase() === "select") {
        el.selectedIndex = 0;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        setInputValue(el, "");
      }
      el.classList.remove("ai-prefilled-field");
    }
    if (!options || !options.silent) {
      AIExt.updateStatus("Form fields reset.", "idle");
    }
  }

  Object.assign(AIExt, {
    isDataEntryPage,
    findWebsiteNameInput,
    getTargetUrl,
    getElementContext,
    detectFormElements,
    setInputValue,
    setSelectValue,
    highlightField,
    fillFormFields,
    clearFilledFields
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
