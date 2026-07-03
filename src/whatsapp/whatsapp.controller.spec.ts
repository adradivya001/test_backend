import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppController } from './whatsapp.controller';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { RedisService } from '../common/redis/redis.service';
import { ReportsService } from '../reports/reports.service';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';

describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let configService: ConfigService;
  let whatsappService: WhatsAppService;
  let workflowsService: WorkflowsService;
  let redisService: RedisService;
  let reportsService: ReportsService;
  let prismaService: PrismaService;
  let patientsService: PatientsService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'WHATSAPP_VERIFY_TOKEN') return 'secure_verify_token';
      return defaultValue;
    }),
  };

  const mockWhatsAppService = {
    sendMessage: jest.fn(),
    sendInteractiveButtons: jest.fn(),
  };

  const mockWorkflowsService = {
    handleAppointmentWorkflow: jest.fn(),
    handleReportStatusWorkflow: jest.fn(),
    handleKnowledgeWorkflow: jest.fn(),
    handleEscalationWorkflow: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockReportsService = {
    generateSecureUrl: jest.fn().mockResolvedValue('/reports/download/report-123?token=mocktoken'),
  };

  const mockPrismaService = {
    notificationLog: {
      updateMany: jest.fn(),
    },
  };

  const mockPatientsService = {
    findByPhone: jest.fn(),
    getTimeline: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: WorkflowsService, useValue: mockWorkflowsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ReportsService, useValue: mockReportsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PatientsService, useValue: mockPatientsService },
      ],
    }).compile();

    controller = module.get<WhatsAppController>(WhatsAppController);
    configService = module.get<ConfigService>(ConfigService);
    whatsappService = module.get<WhatsAppService>(WhatsAppService);
    workflowsService = module.get<WorkflowsService>(WorkflowsService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
    patientsService = module.get<PatientsService>(PatientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyWebhook', () => {
    it('should return challenge if verify token matches', () => {
      const result = controller.verifyWebhook('subscribe', 'my_challenge', 'secure_verify_token');
      expect(result).toBe('my_challenge');
    });

    it('should throw ForbiddenException if verify token does not match', () => {
      expect(() => {
        controller.verifyWebhook('subscribe', 'my_challenge', 'wrong_token');
      }).toThrow(ForbiddenException);
    });
  });

  describe('handleWebhook', () => {
    it('should return ignored status if payload has no messages', async () => {
      const result = await controller.handleWebhook({}, { headers: {} });
      expect(result).toEqual({ status: 'ignored' });
    });

    it('should process user text message and update session in Redis', async () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '+1234567890',
                      text: { body: 'Cardiology' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify({ step: 'department_selection' }));
      mockWorkflowsService.handleAppointmentWorkflow.mockResolvedValue({
        step: 'doctor_selection',
        doctors: [{ id: 'doc-1', name: 'Dr. House' }],
      });

      const result = await controller.handleWebhook(payload, { headers: {} });
      expect(result).toEqual({ status: 'processed' });
      expect(mockRedisService.get).toHaveBeenCalledWith('whatsapp_session:+1234567890');
      expect(mockWorkflowsService.handleAppointmentWorkflow).toHaveBeenCalledWith({
        phone: '+1234567890',
        sessionData: { step: 'doctor_selection', departmentId: 'Cardiology' },
      });
      expect(mockWhatsAppService.sendInteractiveButtons).toHaveBeenCalledWith(
        '+1234567890',
        'Select a Doctor:',
        [{ id: 'doc-1', title: 'Dr. House' }],
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'whatsapp_session:+1234567890',
        JSON.stringify({ step: 'doctor_selection', departmentId: 'Cardiology' }),
        3600,
      );
    });
  });
});
