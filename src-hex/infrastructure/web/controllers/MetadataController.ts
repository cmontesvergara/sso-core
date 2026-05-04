import { Request, Response, NextFunction } from 'express';

export class MetadataController {
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      res.status(201).json({ success: true, message: 'Metadata saved', metadata: { userId, ...req.body } });
    } catch (error) { next(error); }
  };

  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      res.json({ success: true, metadata: { userId } });
    } catch (error) { next(error); }
  };

  putRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      res.json({ success: true, message: 'Metadata updated', metadata: { userId, ...req.body } });
    } catch (error) { next(error); }
  };
}
