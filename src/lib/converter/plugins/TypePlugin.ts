import {
    ReflectionKind,
    DeclarationReflection,
    DeclarationHierarchy,
    ProjectReflection,
    Reflection,
} from "../../models/reflections/index";
import { Type, ReferenceType } from "../../models/types";
import { Converter } from "../converter";
import type { Context } from "../context";
import { ApplicationEvents } from "../../application-events";
import type { Application } from "../../application";
import { Bound, Plugin } from "../../utils";

/**
 * Responsible for adding `implementedBy` / `implementedFrom`
 */
@Plugin("typedoc:type")
export class TypePlugin {
    reflections = new Set<DeclarationReflection>();

    /**
     * Create a new TypeHandler instance.
     */
    constructor(app: Application) {
        app.converter.on(Converter.EVENT_RESOLVE, this.onResolve);
        app.converter.on(Converter.EVENT_RESOLVE_END, this.onResolveEnd);
        app.converter.on(Converter.EVENT_END, () => this.reflections.clear());
        app.on(ApplicationEvents.REVIVE, this.onRevive);
    }

    @Bound
    private onRevive(project: ProjectReflection) {
        for (const id in project.reflections) {
            this.resolve(
                project,
                project.reflections[id],
                /* create links */ false,
            );
        }
        this.finishResolve(project);
        this.reflections.clear();
    }

    @Bound
    private onResolve(context: Context, reflection: Reflection) {
        this.resolve(context.project, reflection);
    }

    private resolve(
        project: ProjectReflection,
        reflection: Reflection,
        createLinks = true,
    ) {
        if (!(reflection instanceof DeclarationReflection)) return;

        if (reflection.kindOf(ReflectionKind.ClassOrInterface)) {
            this.postpone(reflection);

            walk(reflection.implementedTypes, (target) => {
                this.postpone(target);
                target.implementedBy ||= [];
                if (createLinks) {
                    target.implementedBy.push(
                        ReferenceType.createResolvedReference(
                            reflection.name,
                            reflection,
                            project,
                        ),
                    );
                }
            });

            walk(reflection.extendedTypes, (target) => {
                this.postpone(target);
                target.extendedBy ||= [];

                if (createLinks) {
                    target.extendedBy.push(
                        ReferenceType.createResolvedReference(
                            reflection.name,
                            reflection,
                            project,
                        ),
                    );
                }
            });
        }

        function walk(
            types: Type[] | undefined,
            callback: { (declaration: DeclarationReflection): void },
        ) {
            if (!types) {
                return;
            }
            types.forEach((type) => {
                if (!(type instanceof ReferenceType)) {
                    return;
                }
                if (
                    !type.reflection ||
                    !(type.reflection instanceof DeclarationReflection)
                ) {
                    return;
                }
                callback(type.reflection);
            });
        }
    }

    private postpone(reflection: DeclarationReflection) {
        this.reflections.add(reflection);
    }

    @Bound
    private onResolveEnd(context: Context) {
        this.finishResolve(context.project);
    }

    private finishResolve(project: ProjectReflection) {
        this.reflections.forEach((reflection) => {
            if (reflection.implementedBy) {
                reflection.implementedBy.sort((a, b) => {
                    if (a.name === b.name) {
                        return 0;
                    }
                    return a.name > b.name ? 1 : -1;
                });
            }

            let root!: DeclarationHierarchy;
            let hierarchy!: DeclarationHierarchy;
            function push(types: Type[]) {
                const level: DeclarationHierarchy = { types: types };
                if (hierarchy) {
                    hierarchy.next = level;
                    hierarchy = level;
                } else {
                    root = hierarchy = level;
                }
            }

            if (reflection.extendedTypes) {
                push(reflection.extendedTypes);
            }

            push([
                ReferenceType.createResolvedReference(
                    reflection.name,
                    reflection,
                    project,
                ),
            ]);
            hierarchy.isTarget = true;

            if (reflection.extendedBy) {
                push(reflection.extendedBy);
            }

            reflection.typeHierarchy = root;
        });
    }
}
