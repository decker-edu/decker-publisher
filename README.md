# Decker Publishing Service

## Building

### Install packages

```npm install```

### Run build

```npm run build```

### Start service

```npm run start```

To build and run immediatly use: `compile and run`

```npm run car```

## Install external dependencies

### postgresql

This service uses `postgresql` as a database backend.

```apt install postgresql```

### ffmpeg

This service emulates some upload backends of the decker webserver (using `decker --server`).
Those include accepting `-recording.webm` video recordings (for both replacement and appending multiple videos),
accepting `-annot.json` whiteboard annotations and `-times.json` slide transition data.

After video uploads are done the `.webm` videos will automatically be crunched to their respective `.mp4` to be
embedded as a lecture recording immediatly.

This requires `ffmpeg` to convert and combine all `.webm` videos according to `decker`'s own specs.

```apt install ffmpeg`

### whisper.cpp

In addition this service also takes the resulting videos and uses `whisper.cpp` to generate
subtitles of the resulting slides. Accordingly, `whsiper.cpp` needs to be compiled on the
device of this service and the corresponding paths to its executable and model to use needs
to be specified.

## CLI

Manual interaction with the database can be done via the CLI.

You can call the CLI from within the project directory using `npm run cli --` followed by the command and the arguments:

### Create a new user request

To create a new user request that does not match the mail address equirements, use:

`npm run cli -- --create-request '<username>' '<mail>' '<reason>'`

### Create a new account

To directly create a new account, use:

`npm run cli -- --create-account '<username>' '<mail>' '<password>'`

### Delete account

To directly delete an account and all associated data, use:

`npm run cli -- --delete-account <id>`

### Delete account request

To delete an account request, use:

`npm run cli -- --delete-request <id>`

### List data

To get a list of data for debugging use:

```
npm run cli -- --list-feedback
npm run cli -- --list-accounts
npm run cli -- --list-requests
```

### Force feedback user file

To export the userfile required by the decker feedback backend, use:

`npm run cli -- --export-feedback`

## Configure and Setup

Copy the `config.json.skel` file to `config.json` and enter the required fields.

``` json
{
    "session_secret": "An arbitrary string used as a seed for the session storage",
    "database": {
        "pg_user": "Postgresql username",
        "pg_pass": "Postgresql password",
        "pg_base": "Postgresql database",
        "pg_host": "Postgresql hostname",
        "pg_port": 5432 // Postgresql port
    },
    "feedback_db_file": "Location for the export of the user database file for the decker feedback engine.",
    "user_directory_name": "Location where all uploads of users should be stored",
    "amberscriptCallbackUrl": "Deprecated, but left if anyone wants to use their service to automate subtitle / caption generation",
    "amberscriptAPIKey": "Deprecated, but left if anyone wants to use their service to automate subtitle / caption generation",
    "setup_admin": { // if left blank, the setup script will ask for values not provided
        "username": "initial admin user username",
        "password": "initial admin user password",
        "email": "initial admin user email" 
    },
    "mail_config": { // configure the program that should be launched when sending mails, arguments expect msmtp like arguments are available
        "mail_program": "",
        "mail_from": ""
    },
    "hostname": "url to link back to if the root of this service needs to be referenced",
    "whisperProgram": "path to whisper.cpp's main executable",
    "whisperModel": "path to whisper.cpp's model to use"
}
```

Then run

```npm run setup```

this creates all tables in the provided database and creates the default admin user.

## Configuring the reverse proxy

This service can deliver any published website through its `/decks/:username/:project` endpoint.

To improve reliability of access to the published presentations you can direct your reverse proxy to 
directly deliver the files to the user.

You can find an example `nginx` config in the [external](./external/nginx.conf) directory.

## Configuring rsync access

The service is designed to check and manage projects based on existing files in the filesystem, not a database
of metadata. A primary feature of `decker` is the synchronization of a presentation on a remote webserver.

This is done via `rsync`. This means that all files uploaded by users as part of a project need to be accessible
via `rsync` and all projects synchronized to the webserver via `rsync` should be visible and maintainable through
the webinterface.

In order to have access via `rsync` the user needs to be able to access the computer running this service via `ssh`.

To grant this access and not allow a user to use the server this service is running on as a convenient remote device,
access to programs, directories and other usual capabilities of an `ssh`-session need to be suppressed.

The implementation we are currently adapting is a multi step process that can certainly be improved upon.

First every user of the service needs a UNIX account to connect to. This can be done by scraping the user database
and using a tool like ansible to create missing UNIX user accounts for every user account. A pyhton script for
that is available in the [external](./external/fetch-users.py) directory. The 
[ansible playbook](./external/user-playbook.yaml) can be executed regularily via a cron job for example.

Next, arbitrary logins and usage of `ssh`, used by `rsync`, needs to be resticted and the source of the
authorized keys per user needs to be supplied by the database. Configure your `sshd.conf` to use 
something like the [query_ssh_keys.py](./external/query_ssh_keys.py) script as its `AuthorizedKeysCommand`
to query the accepted ssh keys from the database on login. The script echos an ssh-key with a `command`
directive that forces execution of the [only-rsync](./external/only-rsync.sh) shellscript. This shellscript
only allows execution of `rsync` commands via `ssh`.

### Considered improvements

A better usage would be to use `rrsync` as the command value of the returned authorized key. This program
restricts usage of the connection to the use of `rsync` and also allows the specification of a relative
root directory, making usage of additional programs like `chroot` in the `only-rsync` script unneccessary.

With this the users can also be queried: Instead of checking the login username one can have one `upload` user
and modify the `rrsync` command returned with the authorized key to modify which directory the upload user
syncs to. 

The ansible playbook also adjusts file access rights so the user running the decker publisher service is
capable of modifying the files uploaded by the UNIX user via `rsync` regularly.

