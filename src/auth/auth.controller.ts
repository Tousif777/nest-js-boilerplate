import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Res, Get, ConflictException, InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { SignUpDto } from './dto/sign-up.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body(new ValidationPipe()) signUpDto: SignUpDto) {
    try {
      const result = await this.authService.signUp(signUpDto.email, signUpDto.password, signUpDto.name);
      return {
        error: false,
        message: 'User signed up successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException({ error: true, message: error.message });
      }
      throw new InternalServerErrorException({ error: true, message: 'Something went wrong' });
    }
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: { email: string; password: string }) {
    const { accessToken, refreshToken } = await this.authService.signIn(signInDto.email, signInDto.password);
    return {
      error: false,
      message: 'User signed in successfully',
      data: { accessToken }
    };
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) response: Response
  ) {
    const userId = req.user['sub'];
    const refreshToken = req.user['refreshToken'];
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    
    // Set new refresh token as HttpOnly cookie
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    return {
      error: false,
      message: 'Tokens refreshed successfully',
      data: { accessToken: tokens.accessToken }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  getMe(@Req() req: Request, @Res() res: Response) {
    const user = res.locals.user;

    if (user) {
      return res.json({
        error: false,
        message: 'User information retrieved successfully',
        data: {
          id: user._id,
          email: user.email,
          name: user.name
          // Add any other fields you want to return, but be careful not to expose sensitive information
        }
      });
    } else {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: true,
        message: 'User information not found in res.locals'
      });
    }
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
}
