import { IsString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateCatDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(30)
  age: number;

  @IsString()
  @IsNotEmpty()
  breed: string;
}
