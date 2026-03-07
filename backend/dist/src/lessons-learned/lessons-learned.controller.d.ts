import type { RbacUser } from '../rbac/rbac.types';
import { CreateLessonLearnedDto } from './dto/create-lesson-learned.dto';
import { CreateLessonLearnedTypeDto } from './dto/create-lesson-learned-type.dto';
import { ListLessonLearnedDto } from './dto/list-lesson-learned.dto';
import { UpdateLessonLearnedDto } from './dto/update-lesson-learned.dto';
import { UpdateLessonLearnedTypeDto } from './dto/update-lesson-learned-type.dto';
import { LessonsLearnedService } from './lessons-learned.service';
export declare class LessonsLearnedController {
    private readonly lessons;
    constructor(lessons: LessonsLearnedService);
    list(query: ListLessonLearnedDto, user: RbacUser): Promise<{
        items: any;
    }>;
    listTypes(user: RbacUser): Promise<{
        items: any;
    }>;
    create(dto: CreateLessonLearnedDto, user: RbacUser): Promise<any>;
    createType(dto: CreateLessonLearnedTypeDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateLessonLearnedDto, user: RbacUser): Promise<any>;
    updateType(id: string, dto: UpdateLessonLearnedTypeDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    removeType(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
