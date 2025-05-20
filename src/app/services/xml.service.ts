import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { XmlContent } from './github.service';

@Injectable({
  providedIn: 'root'
})
export class XmlService {
  constructor(private http: HttpClient) { }

  // Fetch XMLs from an API
  fetchXmlsFromApi(apiUrl: string): Observable<XmlContent[]> {
    return this.http.get<XmlContent[]>(apiUrl)
      .pipe(
        catchError(error => throwError(() => new Error(`Failed to fetch XMLs: ${error.message}`)))
      );
  }

  // Mock method to simulate fetching XMLs when no actual API is available
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
