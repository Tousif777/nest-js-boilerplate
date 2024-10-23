import { Injectable, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat, CatDocument } from './schemas/cat.schema';
import { faker } from '@faker-js/faker';

@Injectable()
export class CatsService {
  constructor(@InjectModel(Cat.name) private catModel: Model<CatDocument>) { }

  async create(createCatDto: CreateCatDto, userId: string): Promise<Cat> {
    const createdCat = new this.catModel({
      ...createCatDto,
      addedBy: userId,
    });
    return createdCat.save();
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{
    error: boolean;
    data: Partial<Cat>[];
    message: string;
    total: number;
    page: number;
    totalPages: number;
    nextPage: boolean;
    prevPage: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [result] = await this.catModel.aggregate([
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: { $toString: '$_id' },
                name: 1,
                age: 1,
                breed: 1,
                createdAt: 1
              }
            }
          ],
          total: [
            { $count: 'count' }
          ]
        }
      },
      {
        $project: {
          data: 1,
          total: { $arrayElemAt: ['$total.count', 0] }
        }
      }
    ]);

    const { data, total } = result;
    const totalPages = Math.ceil(total / limit);

    return {
      error: false,
      data,
      message: 'Cats found successfully',
      total,
      page,
      totalPages,
      nextPage: page < totalPages,
      prevPage: page > 1,
    };
  }

  async findOne(id: string): Promise<{ error: boolean; data: Cat | null; message: string }> {
    const [result] = await this.catModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $project: {
          _id: { $toString: '$_id' },
          name: 1,
          age: 1,
          breed: 1,
        }
      }
    ]);

    return {
      error: false,
      data: result || null,
      message: result ? 'Cat found successfully' : 'Cat not found'
    };
  }

  async update(id: string, updateCatDto: UpdateCatDto, userId: string): Promise<{ error: boolean; data: Cat | null; message: string }> {
    const updatedCat = await this.catModel.findByIdAndUpdate(id, updateCatDto, { new: true }).exec();
    return {
      error: false,
      data: updatedCat,
      message: 'Cat updated successfully'
    };
  }

  async remove(id: string, userId: string): Promise<{ error: boolean; message: string }> {
    //find the cat by id and match the addedBy field with the userId
    const cat = await this.catModel.findOne({ _id: id, addedBy: userId }).exec();
    if (!cat) {
      throw new NotFoundException('Cat not found');
    }
    //delete the cat
    const deletedCat = await this.catModel.findByIdAndDelete(id).exec();
    return {
      error: false,
      message: 'Cat deleted successfully'
    };
  }
  
}
