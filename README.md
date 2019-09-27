# @eropple/nestjs-data-sec #
[![npm version](https://badge.fury.io/js/%40eropple%2Fnestjs-data-sec.svg)](https://badge.fury.io/js/%40eropple%2Fnestjs-data-sec)

Even with the benefits of TypeScript's typing system, it's still very easy to
write a controller hander, without thinking, that returns an object that contains
data that shouldn't be sent over the wire. Sure, you're probably using Argon2
or some other quality password hash, but you still shouldn't return that `User`
object that contains it!

`data-sec` exists to help with that by allowing you to specify (using
`@nestjs/swagger` annotations) the _output type_ of your endpoint/Swagger
operation, irrespective of what is actually returned by your _controller_. So,
for example, you can return a `Promise<User>` out of a handler, but by
specifying `@ApiOkResponse({ type: UserPublic })`, you indicate to `data-sec`
that it should attempt to convert the `User` into a `UserPublic` (with the
`UserPublic` lacking sensitive fields like email, as well as internal fields
like the user's password hash).

Any method with a Swagger API response (`@ApiResponse`, `@ApiOkResponse`, etc.)
will automatically opt that endpoint into `data-sec`. You can tag a given
endpoint with `@DataSecOptOut()` to tell `data-sec` not to enforce rules on
it; this can then be something that goes into your code review pipeline to
make sure this is a valid use of the opt-out. (If you return something that
isn't JSON, such as a data stream, you will need to do this.)

This also means that non-sensitive data objects will also be checked by
`data-sec`; you can decorate those with `@AllowReturnAsSelf()` to allow them
to pass.

## Non-2XX HTTTP Codes ##
There's one important note to be aware of when using `data-sec`. Unless you
_specifically_ define an `@ApiOperation()` for a given HTTP status code that
is outside of the 200-299 range, `data-sec` will allow anything to pass. This
is intentional, as most Swagger users don't exhaustively document the schema
for things like redirects or unforeseen errors.

## Example ##
```ts
// our domain type, returnable from our controller
export class UserPublic {
  constructor(
    readonly id: string,
    readonly username: string
  ) {}

  static fromUser(user: User): UserPublic {
    return new UserPublic(user.id, user.username);
  }
}

export class UserPrivate {
  constructor(
    readonly id: string,
    readonly username: string,
    readonly email: string,
    readonly hasPassword: boolean
  ) {}

  static fromUser(user: User): UserPrivate {
    return new UserPrivate(user.id, user.username, user.email, !!user.passwordHash);
  }
}

// consider a TypeORM user (or equivalent)...
// this has fields we don't want to return to all users (email)
@Entity({ name: "users" })
@AllowReturnAs(UserPublic, UserPublic.fromUser) // here's the magic
@AllowReturnAs(UserPrivate, UserPrivate.fromUser)
export class User {
  static readonly USERNAME_VALIDATOR = Joi.string().min(4).max(20).regex(/a-zA-z0-9\-/);
  static readonly PASSWORD_VALIDATOR = Joi.string().min(6);

  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  username!: string;

  @Column()
  email!: string;

  @Column()
  passwordHash?: string;
}

@Controller("auth")
export class AuthController {
  // for the sake of brevity (as I extracted this from working code) please assume
  // that `AuthRequired` populates the request object with a user that `@Principal()`
  // then passes to the handler.
  @Get("whoami")
  @ApiOperation({ title: "whoami" })
  @ApiOkResponse({ type: UserPrivate })
  @UseGuards(AuthRequired) // populates the request, so @Principal succeeds below
  async whoami(@Principal() user: User): Promise<User> {
    // while we return a User out of the method, data-sec will transform it into
    // UserPublic. It will return a 500 error if User cannot be transformed into
    // UserPublic.
    return user;
  }
}

// and then, when you're making your app (make sure to add it for e2e tests too!)

// this uses Bunyan for logging. you can find a Winston adapter if you're
// not using Bunyan. (you should use Bunyan.)
const myLogger = Bunyan({ name: "my-cool-app"});

function globalInterceptors(app: INestApplication) {
  // defaults to a blackhole logger if you don't pass your own, but I recommend using a
  // logger because data-sec will tell you when it dumps a request.
  app.use(new DataSecInterceptor(myLogger));
}
```

## Future Work (PRs welcome!) ##
- Decouple from `@nestjs/swagger`; provide own decorator for defining a response type
  (for users not using Swagger)
- Decouple from NestJS HTTP; the same basic idea should be usable with websockets
- Add support for returning arrays of objects
- Bypass `data-sec` when streams are returned or when `@nestjs/swagger` operations are
  not returning `application/json`
