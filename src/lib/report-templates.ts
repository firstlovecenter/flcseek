import { prisma } from './prisma';
import { logger } from './logger';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'table' | 'chart' | 'metrics';
  metrics?: string[]; // field names to include
  includeVisuals: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  sections: ReportSection[];
  isPublic: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt?: Date;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'never';
  nextScheduledDate?: Date;
  recipients?: string[]; // email addresses
}

export class ReportTemplatesService {
  /**
   * Create a new report template
   */
  static async createTemplate(
    data: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ReportTemplate> {
    try {
      const template = await prisma.reportTemplate.create({
        data: {
          name: data.name,
          description: data.description,
          templateConfig: JSON.parse(
            JSON.stringify({
              sections: data.sections,
              scheduleFrequency: data.scheduleFrequency,
              recipients: data.recipients,
            })
          ),
          isPublic: data.isPublic,
          createdBy: data.createdById,
        },
      });

      logger.info('Report template created', { templateId: template.id, name: data.name });
      return this.mapTemplate(template);
    } catch (error) {
      logger.error('Failed to create report template', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get a template by ID
   */
  static async getTemplate(id: string): Promise<ReportTemplate | null> {
    try {
      const template = await prisma.reportTemplate.findUnique({
        where: { id },
      });
      return template ? this.mapTemplate(template) : null;
    } catch (error) {
      logger.error('Failed to get report template', { id });
      return null;
    }
  }

  /**
   * List templates for all users (public and user's own)
   */
  static async listTemplates(userId?: string, includePublic: boolean = true) {
    try {
      const where: any = {};
      if (userId) {
        where.OR = [
          { createdBy: userId },
          ...(includePublic ? [{ isPublic: true }] : []),
        ];
      } else if (includePublic) {
        where.isPublic = true;
      }

      const templates = await prisma.reportTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return templates.map((t) => this.mapTemplate(t));
    } catch (error) {
      logger.error('Failed to list report templates');
      return [];
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(
    id: string,
    data: Partial<Omit<ReportTemplate, 'id' | 'createdAt' | 'createdById'>>
  ): Promise<ReportTemplate | null> {
    try {
      const template = await prisma.reportTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          templateConfig: data.sections
            ? JSON.parse(
                JSON.stringify({
                  sections: data.sections,
                  scheduleFrequency: data.scheduleFrequency,
                  recipients: data.recipients,
                })
              )
            : undefined,
          isPublic: data.isPublic,
        },
      });

      logger.info('Report template updated', { templateId: id });
      return this.mapTemplate(template);
    } catch (error) {
      logger.error('Failed to update report template', { id });
      return null;
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    try {
      await prisma.reportTemplate.delete({
        where: { id },
      });

      logger.info('Report template deleted', { templateId: id });
      return true;
    } catch (error) {
      logger.error('Failed to delete report template', { id });
      return false;
    }
  }

  /**
   * Generate PDF report from template
   */
  static async generatePDFReport(
    templateId: string,
    groupId: string,
    data: Record<string, any>
  ): Promise<Buffer | null> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) return null;

      const doc = new jsPDF();
      let yPosition = 10;

      // Title
      doc.setFontSize(16);
      doc.text(template.name, 10, yPosition);
      yPosition += 10;

      // Date
      doc.setFontSize(10);
      doc.text(`Generated: ${dayjs().format('MMMM D, YYYY h:mm A')}`, 10, yPosition);
      yPosition += 10;

      // Sections
      for (const section of template.sections) {
        doc.setFontSize(12);
        doc.text(section.title, 10, yPosition);
        yPosition += 8;

        if (section.type === 'metrics' && section.metrics) {
          // Display metrics
          doc.setFontSize(10);
          for (const metric of section.metrics) {
            const value = data[metric] || 'N/A';
            doc.text(`${metric}: ${value}`, 15, yPosition);
            yPosition += 6;
          }
        } else if (section.type === 'table' && data[section.id]) {
          // Display table
          autoTable(doc, {
            head: [Object.keys(data[section.id][0] || {})],
            body: data[section.id].map((row: any) => Object.values(row)),
            startY: yPosition,
            margin: { left: 10, right: 10 },
          });
          yPosition = (doc as any).lastAutoTable?.finalY + 10;
        }

        yPosition += 5;
      }

      return Buffer.from(doc.output('arraybuffer'));
    } catch (error) {
      logger.error('Failed to generate PDF report', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate report data based on template
   */
  static async generateReportData(templateId: string, groupId: string): Promise<Record<string, any> | null> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) return null;

      const data: Record<string, any> = {};

      for (const section of template.sections) {
        if (section.type === 'summary') {
          // Get group summary stats
          const convertCount = await prisma.newConvert.count({ where: { groupId, deletedAt: null } });
          const activeCount = await prisma.newConvert.count({
            where: { groupId, deletedAt: null },
          });

          data.convertCount = convertCount;
          data.activeCount = activeCount;
          data.activityRate = convertCount > 0 ? ((activeCount / convertCount) * 100).toFixed(1) : 0;
        } else if (section.type === 'table' && section.metrics) {
          // Fetch converts with specified metrics
          const converts = await prisma.newConvert.findMany({
            where: { groupId, deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
            take: 100,
          });

          data[section.id] = converts.map((c) => ({
            Name: `${c.firstName} ${c.lastName}`,
            Phone: c.phoneNumber || 'N/A',
          }));
        }
      }

      return data;
    } catch (error) {
      logger.error('Failed to generate report data', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Helper: Map database template to ReportTemplate type
   */
  private static mapTemplate(template: any): ReportTemplate {
    const config = typeof template.templateConfig === 'string' 
      ? JSON.parse(template.templateConfig) 
      : template.templateConfig;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      sections: config?.sections || [],
      isPublic: template.isPublic,
      createdById: template.createdBy,
      createdAt: template.createdAt,
      scheduleFrequency: config?.scheduleFrequency,
      nextScheduledDate: config?.nextScheduledDate,
      recipients: config?.recipients,
    };
  }
}
