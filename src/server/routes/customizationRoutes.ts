import { Router, Request, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  systemCustomization,
  loginCustomization,
  footerCustomization,
} from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest, requireAuth, requireRole, logAudit } from '../auth.ts';

const router = Router();

// Sanitizer helper: strip raw HTML tags to prevent XSS injection
function sanitizeText(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>?/gm, '');
}

// GET /api/customization/public - Accessible without auth for login page & shell
router.get('/public', async (req: Request, res: Response) => {
  try {
    const sys = await db.select().from(systemCustomization);
    const login = await db.select().from(loginCustomization);
    const footer = await db.select().from(footerCustomization);

    return res.json({
      system: sys[0] || null,
      login: login[0] || null,
      footer: footer[0] || null,
    });
  } catch (err: any) {
    console.error('Public customization fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch public customization.' });
  }
});

// GET /api/customization/system - Regional only
router.get('/system', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resList = await db.select().from(systemCustomization);
    return res.json(resList[0] || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch system customization.' });
  }
});

// PUT /api/customization/system - Regional only
router.put('/system', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      siteTitle,
      regionTitle,
      navbarLogo,
      favicon,
      baseFontSize,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
    } = req.body;

    const existing = await db.select().from(systemCustomization);
    const payload: any = {
      siteTitle: sanitizeText(siteTitle || 'Project SBM Online'),
      regionTitle: sanitizeText(regionTitle || 'Department of Education Regional Office VIII'),
      navbarLogo: navbarLogo || null,
      favicon: favicon || null,
      baseFontSize: Number(baseFontSize) || 15,
      primaryColor: primaryColor || '#0038a8',
      secondaryColor: secondaryColor || '#495057',
      accentColor: accentColor || '#ce1126',
      backgroundColor: backgroundColor || '#f4f6f9',
      updatedAt: new Date(),
    };

    let updated;
    if (existing.length === 0) {
      [updated] = await db.insert(systemCustomization).values(payload).returning();
    } else {
      [updated] = await db.update(systemCustomization).set(payload).where(eq(systemCustomization.id, existing[0].id)).returning();
    }

    await logAudit(req, 'UPDATE_SYSTEM_CUSTOMIZATION', 'system_customization', updated.id);
    return res.json({ message: 'System branding updated successfully.', data: updated });
  } catch (err: any) {
    console.error('Update system error:', err);
    return res.status(500).json({ error: 'Failed to update system customization.' });
  }
});

// GET /api/customization/login - Regional only
router.get('/login', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resList = await db.select().from(loginCustomization);
    return res.json(resList[0] || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch login customization.' });
  }
});

// PUT /api/customization/login - Regional only
router.put('/login', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      eyebrowText,
      mainHeading,
      description,
      loginFormTitle,
      loginFormDescription,
      publicAnnouncement,
      loginLogo,
      brandPanelBg,
      primaryColor,
      gradientColor,
      accentColor,
      loginPanelColor,
      showFullFooter,
    } = req.body;

    const existing = await db.select().from(loginCustomization);
    const payload: any = {
      eyebrowText: sanitizeText(eyebrowText || ''),
      mainHeading: sanitizeText(mainHeading || ''),
      description: sanitizeText(description || ''),
      loginFormTitle: sanitizeText(loginFormTitle || ''),
      loginFormDescription: sanitizeText(loginFormDescription || ''),
      publicAnnouncement: sanitizeText(publicAnnouncement || ''),
      loginLogo: loginLogo || null,
      brandPanelBg: brandPanelBg || null,
      primaryColor: primaryColor || '#0038a8',
      gradientColor: gradientColor || '#002266',
      accentColor: accentColor || '#ce1126',
      loginPanelColor: loginPanelColor || '#ffffff',
      showFullFooter: showFullFooter !== undefined ? Boolean(showFullFooter) : true,
      updatedAt: new Date(),
    };

    let updated;
    if (existing.length === 0) {
      [updated] = await db.insert(loginCustomization).values(payload).returning();
    } else {
      [updated] = await db.update(loginCustomization).set(payload).where(eq(loginCustomization.id, existing[0].id)).returning();
    }

    await logAudit(req, 'UPDATE_LOGIN_CUSTOMIZATION', 'login_customization', updated.id);
    return res.json({ message: 'Login page appearance updated successfully.', data: updated });
  } catch (err: any) {
    console.error('Update login error:', err);
    return res.status(500).json({ error: 'Failed to update login customization.' });
  }
});

// GET /api/customization/footer - Regional only
router.get('/footer', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resList = await db.select().from(footerCustomization);
    return res.json(resList[0] || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch footer customization.' });
  }
});

// PUT /api/customization/footer - Regional only
router.put('/footer', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      firstWideLogo,
      logo2,
      logo3,
      footerText,
      supportEmail,
      telephone,
      dataPrivacyUrl,
      termsUrl,
      userManualUrl,
      facebookUrl,
      websiteUrl,
    } = req.body;

    // Strict no raw HTML check: footer text uses **bold** and *italic* markdown only
    const cleanFooterText = sanitizeText(footerText || '');

    const existing = await db.select().from(footerCustomization);
    const payload: any = {
      firstWideLogo: firstWideLogo || null,
      logo2: logo2 || null,
      logo3: logo3 || null,
      footerText: cleanFooterText,
      supportEmail: sanitizeText(supportEmail || 'qad.region8@deped.gov.ph'),
      telephone: sanitizeText(telephone || '(053) 832-2997'),
      dataPrivacyUrl: sanitizeText(dataPrivacyUrl || '#'),
      termsUrl: sanitizeText(termsUrl || '#'),
      userManualUrl: sanitizeText(userManualUrl || '#'),
      facebookUrl: sanitizeText(facebookUrl || 'https://www.facebook.com/DepEdROVIII'),
      websiteUrl: sanitizeText(websiteUrl || 'https://region8.deped.gov.ph'),
      updatedAt: new Date(),
    };

    let updated;
    if (existing.length === 0) {
      [updated] = await db.insert(footerCustomization).values(payload).returning();
    } else {
      [updated] = await db.update(footerCustomization).set(payload).where(eq(footerCustomization.id, existing[0].id)).returning();
    }

    await logAudit(req, 'UPDATE_FOOTER_CUSTOMIZATION', 'footer_customization', updated.id);
    return res.json({ message: 'Footer configuration updated successfully.', data: updated });
  } catch (err: any) {
    console.error('Update footer error:', err);
    return res.status(500).json({ error: 'Failed to update footer customization.' });
  }
});

export default router;
