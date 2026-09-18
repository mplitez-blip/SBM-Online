import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../../db/index.ts';
import {
  systemCustomization,
  loginCustomization,
  footerCustomization,
} from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest, requireAuth, requireRole, logAudit } from '../auth.ts';
import {
  validateUploadedAsset,
  generateUniqueAssetFilename,
  saveAssetToDisk,
  deleteReplacedAsset,
} from '../assetService.ts';

const router = Router();

// Configure Multer with memory storage for binary inspection before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB hard upload buffer limit
  },
});

// Sanitizer helper: strip raw HTML tags to prevent XSS injection while keeping text
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
      system: sys[0] || {
        siteTitle: 'Project SBM Online',
        regionTitle: 'Department of Education Regional Office VIII',
        navbarLogo: null,
        favicon: null,
        baseFontSize: 15,
        primaryColor: '#0038a8',
        secondaryColor: '#495057',
        accentColor: '#ce1126',
        backgroundColor: '#f8f9fa',
      },
      login: login[0] || {
        eyebrowText: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII',
        mainHeading: 'Project SBM Online',
        description: 'A centralized School-Based Management Self-Assessment, Monitoring, Administration, and Reporting System for Eastern Visayas.',
        loginFormTitle: 'Sign In to SBM Portal',
        loginFormDescription: 'Enter your DepEd regional, division, or school credentials to access the system.',
        publicAnnouncement: 'Official SBM self-assessment portal for Regional Office VIII. Validated data serves as the basis for school technical assistance and quality assurance.',
        loginLogo: null,
        brandPanelBg: null,
        primaryColor: '#0038a8',
        gradientColor: '#001a4e',
        accentColor: '#ce1126',
        loginPanelColor: '#ffffff',
        showFullFooter: true,
      },
      footer: footer[0] || {
        firstWideLogo: null,
        logo2: null,
        logo3: null,
        footerText: '**Department of Education Regional Office VIII (Eastern Visayas)**\nQuality Assurance Division (QAD)\nGovernment Center, Candahug, Palo, Leyte 6501\n*Empowering Schools through Evidence-Based Quality Assurance and Self-Assessment.*',
        supportEmail: 'qad.region8@deped.gov.ph',
        telephone: '(053) 832-2997',
        dataPrivacyUrl: '#',
        termsUrl: '#',
        userManualUrl: '#',
        facebookUrl: 'https://www.facebook.com/DepEdROVIII',
        websiteUrl: 'https://region8.deped.gov.ph',
      },
    });
  } catch (err: any) {
    console.error('Public customization fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch public customization.' });
  }
});

// POST /api/customization/upload - Secure asset upload (Regional only)
router.post(
  '/upload',
  requireAuth,
  requireRole('regional'),
  upload.single('assetFile'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let buffer: Buffer | null = null;
      let originalFilename = 'uploaded_asset';
      let category: 'logo' | 'favicon' | 'background' | 'general' = 'general';
      let replaceUrl: string | null = null;

      if (req.file) {
        buffer = req.file.buffer;
        originalFilename = req.file.originalname;
        category = (req.body.category as any) || 'general';
        replaceUrl = req.body.replaceUrl || null;
      } else if (req.body && req.body.base64Data) {
        // Base64 JSON upload fallback
        const base64String = req.body.base64Data;
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(base64String, 'base64');
        }
        originalFilename = req.body.fileName || 'asset.png';
        category = (req.body.category as any) || 'general';
        replaceUrl = req.body.replaceUrl || null;
      }

      if (!buffer) {
        return res.status(400).json({ error: 'No file uploaded or invalid base64 data provided.' });
      }

      // Step 1: Validate MIME type, size, dimensions, and detect executables
      const metadata = validateUploadedAsset(buffer, originalFilename, { category });

      // Step 2: Generate unique non-colliding filename
      const uniqueFilename = generateUniqueAssetFilename(category, metadata.extension);

      // Step 3: Save new file to disk
      const newAssetUrl = await saveAssetToDisk(buffer, uniqueFilename);

      // Step 4: Delete replaced file ONLY AFTER the new file is saved successfully
      if (replaceUrl && replaceUrl !== newAssetUrl) {
        await deleteReplacedAsset(replaceUrl);
      }

      // Step 5: Log audit record
      await logAudit(
        req,
        'UPLOAD_ASSET',
        'customization_asset',
        uniqueFilename,
        `Uploaded ${category} asset: ${metadata.width}x${metadata.height}px (${(metadata.sizeBytes / 1024).toFixed(1)} KB)`
      );

      return res.status(201).json({
        message: 'Asset uploaded and verified successfully.',
        url: newAssetUrl,
        filename: uniqueFilename,
        metadata,
      });
    } catch (err: any) {
      console.error('Asset upload error:', err);
      return res.status(400).json({ error: err.message || 'Asset upload failed security validation.' });
    }
  }
);

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
    const oldNavbarLogo = existing[0]?.navbarLogo;
    const oldFavicon = existing[0]?.favicon;

    const payload: any = {
      siteTitle: sanitizeText(siteTitle || 'Project SBM Online'),
      regionTitle: sanitizeText(regionTitle || 'Department of Education Regional Office VIII'),
      navbarLogo: navbarLogo || null,
      favicon: favicon || null,
      baseFontSize: Math.max(12, Math.min(24, Number(baseFontSize) || 15)),
      primaryColor: primaryColor || '#0038a8',
      secondaryColor: secondaryColor || '#495057',
      accentColor: accentColor || '#ce1126',
      backgroundColor: backgroundColor || '#f8f9fa',
      updatedAt: new Date(),
    };

    let updated;
    if (existing.length === 0) {
      [updated] = await db.insert(systemCustomization).values(payload).returning();
    } else {
      [updated] = await db.update(systemCustomization).set(payload).where(eq(systemCustomization.id, existing[0].id)).returning();
    }

    // Delete replaced files ONLY AFTER new configuration is successfully saved to database
    if (oldNavbarLogo && oldNavbarLogo !== payload.navbarLogo) {
      await deleteReplacedAsset(oldNavbarLogo);
    }
    if (oldFavicon && oldFavicon !== payload.favicon) {
      await deleteReplacedAsset(oldFavicon);
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
    const oldLoginLogo = existing[0]?.loginLogo;
    const oldBrandPanelBg = existing[0]?.brandPanelBg;

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
      gradientColor: gradientColor || '#001a4e',
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

    // Delete replaced files ONLY AFTER new settings are saved
    if (oldLoginLogo && oldLoginLogo !== payload.loginLogo) {
      await deleteReplacedAsset(oldLoginLogo);
    }
    if (oldBrandPanelBg && oldBrandPanelBg !== payload.brandPanelBg) {
      await deleteReplacedAsset(oldBrandPanelBg);
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

    const existing = await db.select().from(footerCustomization);
    const oldFirstLogo = existing[0]?.firstWideLogo;
    const oldLogo2 = existing[0]?.logo2;
    const oldLogo3 = existing[0]?.logo3;

    // Strict no raw HTML: sanitize text
    const cleanFooterText = sanitizeText(footerText || '');

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

    // Delete replaced files ONLY AFTER new footer settings are saved
    if (oldFirstLogo && oldFirstLogo !== payload.firstWideLogo) {
      await deleteReplacedAsset(oldFirstLogo);
    }
    if (oldLogo2 && oldLogo2 !== payload.logo2) {
      await deleteReplacedAsset(oldLogo2);
    }
    if (oldLogo3 && oldLogo3 !== payload.logo3) {
      await deleteReplacedAsset(oldLogo3);
    }

    await logAudit(req, 'UPDATE_FOOTER_CUSTOMIZATION', 'footer_customization', updated.id);
    return res.json({ message: 'Footer configuration updated successfully.', data: updated });
  } catch (err: any) {
    console.error('Update footer error:', err);
    return res.status(500).json({ error: 'Failed to update footer customization.' });
  }
});

export default router;
