import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { XmlContent } from "./github/github.service";

@Injectable({
  providedIn: "root",
})
export class XmlService {
  constructor(private http: HttpClient) {}

  // Fetch XMLs from an API
  fetchXmlsFromApi(apiUrl: string): Observable<XmlContent[]> {
    return this.http.get<any[]>(apiUrl).pipe(
      map((response) => {
        // Handle various response formats
        if (Array.isArray(response)) {
          return response.map((item) => this.normalizeXmlContent(item));
        } else if (typeof response === "object") {
          // If response is an object with XML content
          return [this.normalizeXmlContent(response)];
        }
        throw new Error("Invalid API response format");
      }),
      catchError((error) =>
        throwError(() => new Error(`Failed to fetch XMLs: ${error.message}`))
      )
    );
  }

  // Normalize XML content from various formats into XmlContent interface
  private normalizeXmlContent(data: any): XmlContent {
    // If the data is already in the correct format
    if (data.filename && data.content) {
      return {
        filename: data.filename,
        content: this.ensureValidXml(data.content),
      };
    }

    // If content is direct XML string
    if (typeof data === "string") {
      return {
        filename: `config-${Date.now()}.xml`,
        content: this.ensureValidXml(data),
      };
    }

    // If content is in a different property
    const content = data.xml || data.xmlContent || data.content;
    const filename = data.name || data.filename || `config-${Date.now()}.xml`;

    if (!content) {
      throw new Error("No XML content found in API response");
    }

    return {
      filename: this.ensureXmlExtension(filename),
      content: this.ensureValidXml(content),
    };
  }

  // Ensure filename has .xml extension
  private ensureXmlExtension(filename: string): string {
    if (!filename.toLowerCase().endsWith(".xml")) {
      filename += ".xml";
    }
    return filename;
  }

  // Ensure content is valid XML format
  private ensureValidXml(content: string): string {
    // Add XML declaration if missing
    if (!content.trim().startsWith("<?xml")) {
      content = '<?xml version="1.0" encoding="UTF-8"?>\n' + content;
    }
    return content;
  }

  // Mock method for testing
  mockFetchXmls(envName: string, count: number = 50): XmlContent[] {
    const xmls: XmlContent[] = [];

    for (let i = 1; i <= count; i++) {
      const filename = `${envName}-config-${i}.xml`;
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<configuration environment="${envName}">
  <setting id="setting-${i}">
    <name>Example Setting ${i}</name>
    <value>Value for ${envName} environment</value>
    <description>This is a sample configuration for ${envName}</description>
    <timestamp>${new Date().toISOString()}</timestamp>
  </setting>
</configuration>`;

      xmls.push({ filename, content });
    }

    return xmls;
  }
}
