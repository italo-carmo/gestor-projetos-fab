import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';
import { getErrorCode } from '../common/error-codes';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let code = 'VALIDATION_ERROR';
    if (exception.code === 'LIMIT_FILE_SIZE') {
      code = 'FILE_TOO_LARGE';
    }

    const entry = getErrorCode(code);
    response.status(entry.httpStatus).json({
      message: entry.message,
      code,
      details: entry.details ?? { reason: exception.code },
    });
  }
}
