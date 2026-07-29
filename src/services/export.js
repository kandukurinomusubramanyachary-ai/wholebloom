import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { format } from 'date-fns';
import { doctorReportToText } from './doctorReport';

function exportPayload(state = {}) {
  return {
    USER_PROFILE: state.profile || null,
    CHECKINS: Array.isArray(state.checkins) ? state.checkins : [],
    PERIODS: Array.isArray(state.periods) ? state.periods : [],
    MEALS: Array.isArray(state.meals) ? state.meals : [],
    MOVEMENTS: Array.isArray(state.movements) ? state.movements : [],
    MEDICATIONS: Array.isArray(state.medications) ? state.medications : [],
    DAILY_PLANS: Array.isArray(state.dailyPlans) ? state.dailyPlans : [],
    MEG_CONVERSATIONS: Array.isArray(state.megConversations) ? state.megConversations : [],
    DOCTOR_REPORT_SETTINGS: state.doctorReportSettings || null,
    SETTINGS: state.settings || null,
    AFFIRMATIONS: null,
    BOOKMARKS: Array.isArray(state.bookmarks) ? state.bookmarks : [],
    STATS: state.stats || null,
  };
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(';') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function ascii(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7E\n]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLines(text, maxLength = 88) {
  const lines = [];
  ascii(text).split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    words.forEach((word) => {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= maxLength) line += ` ${word}`;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function createSimplePdf(text) {
  const allLines = wrapLines(text);
  const pages = [];
  for (let index = 0; index < allLines.length; index += 52) pages.push(allLines.slice(index, index + 52));
  if (!pages.length) pages.push(['Bloom doctor-ready summary']);

  const fontObject = 3 + pages.length * 2;
  const objects = {};
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageRefs = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;

  pages.forEach((lines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const commands = ['BT', '/F1 10 Tf', '50 750 Td', '13 TL'];
    lines.forEach((line) => {
      commands.push(`(${line}) Tj`);
      commands.push('T*');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= fontObject; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${fontObject + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontObject; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${fontObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += alphabet[first >> 2];
    result += alphabet[((first & 3) << 4) | ((second || 0) >> 4)];
    result += index + 1 < bytes.length ? alphabet[((second & 15) << 2) | ((third || 0) >> 6)] : '=';
    result += index + 2 < bytes.length ? alphabet[third & 63] : '=';
  }
  return result;
}

class ExportService {
  async exportDoctorReportText(report) {
    const text = doctorReportToText(report);
    const filename = `bloom-doctor-summary-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    return this.saveAndShare(filename, text, 'text/plain');
  }

  async exportDoctorReportJSON(report) {
    const filename = `bloom-doctor-summary-${format(new Date(), 'yyyy-MM-dd')}.json`;
    return this.saveAndShare(filename, JSON.stringify(report, null, 2), 'application/json');
  }

  async exportDoctorReportPDF(report) {
    const filename = `bloom-doctor-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    const bytes = createSimplePdf(doctorReportToText(report));
    if (Platform.OS === 'web') {
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return filename;
    }
    const path = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Export Bloom doctor summary', UTI: 'com.adobe.pdf' });
    }
    return path;
  }

  async exportToJSON(state) {
    const data = exportPayload(state);
    const json = JSON.stringify(data, null, 2);
    const filename = `bloom-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    return this.saveAndShare(filename, json, 'application/json');
  }

  async exportToCSV(state) {
    const data = exportPayload(state);
    const checkins = data.CHECKINS;
    const periods = data.PERIODS;
    
    let csv = 'Bloom Health Data Export\n\n';
    csv += 'CHECK-INS\n';
    csv += 'Date,Mood,Energy,Sleep,Pain,Flow,Symptoms,Notes\n';
    
    checkins.forEach(c => {
      csv += [
        c.date,
        c.mood,
        c.energy,
        c.sleep,
        c.pain,
        c.flow,
        c.symptoms || [],
        c.notes,
      ].map(csvCell).join(',') + '\n';
    });
    
    csv += '\nPERIODS\n';
    csv += 'Start Date,End Date,Flow Intensity\n';
    periods.forEach(p => {
      csv += [p.startDate, p.endDate, p.flow].map(csvCell).join(',') + '\n';
    });
    
    const filename = `bloom-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    return this.saveAndShare(filename, csv, 'text/csv');
  }

  async exportToPDF(state) {
    // Simplified PDF-like export as HTML->PDF requires more libraries
    // For MVP, we'll create a formatted text file
    const data = exportPayload(state);
    const profile = data.USER_PROFILE || {};
    const checkins = data.CHECKINS || [];
    const periods = data.PERIODS || [];
    
    let text = 'BLOOM - HEALTH DATA EXPORT\n';
    text += `Generated: ${new Date().toLocaleString()}\n\n`;
    text += `Name: ${profile.name || profile.firstName || 'Not provided'}\n`;
    text += `Age: ${profile.age || 'Not provided'}\n\n`;
    
    text += 'PERIODS LOGGED: ' + periods.length + '\n';
    periods.forEach(p => {
      text += `- ${p.startDate} to ${p.endDate || 'ongoing'} (${p.flow || 'not specified'})\n`;
    });
    
    text += '\nCHECK-INS: ' + checkins.length + '\n';
    checkins.forEach(c => {
      text += `- ${c.date}: Mood ${c.mood}, Energy ${c.energy}, Sleep ${c.sleep}h, Pain ${c.pain}, Flow ${c.flow}\n`;
    });
    
    const filename = `bloom-export-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    return this.saveAndShare(filename, text, 'text/plain');
  }

  async saveAndShare(filename, content, mimeType) {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return filename;
    }

    const path = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType,
        dialogTitle: 'Export Bloom Data',
        UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.text',
      });
    }
    
    return path;
  }
}

export const exportService = new ExportService();
