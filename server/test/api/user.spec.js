import request from 'supertest';
import chai from 'chai';
import app from '../../../server';
import db from '../../app/models';
import helper from '../testHelper';

const superRequest = request.agent(app);
const expect = chai.expect;


let newAdminUser;
let adminToken;
let regularToken;
let regularUser;
const emptyValue = ['userName', 'lastName', 'firstName', 'password', 'email'];
const uniqueField = ['userName', 'email'];

describe('User API', () => {
  before((done) => {
    db.Role.bulkCreate([{ title: 'admin', id: 1 }, { title: 'regular', id: 2 }])
    .then((role) => {
      helper.adminUser.roleId = role[0].id;
      db.User.create(helper.adminUser)
        .then((admin) => {
          newAdminUser = admin.dataValues;
          done();
        });
    });
  });

  after(() => db.sequelize.sync({ force: true }));

  describe('New Users', () => {
    describe('Create User', () => {
      it('should create a user', (done) => {
        superRequest.post('/users')
          .send(helper.regularUser)
          .end((error, response) => {
            regularUser = response.body.user;
            expect(response.status).to.equal(201);
            expect(response.body.user.userName)
              .to.equal(helper.regularUser.userName);
            expect(response.body.user.firstName)
              .to.equal(helper.regularUser.firstName);
            expect(response.body.user.lastName)
              .to.equal(helper.regularUser.lastName);
            expect(response.body.user.roleId).to.equal(2);
            done();
          });
      });

      emptyValue.forEach((field) => {
        const invalidUser = Object.assign({}, helper.secondUser);
        invalidUser[field] = '';
        it(`should fail when ${field} is invalid`, (done) => {
          superRequest.post('/users')
            .send(invalidUser)
            .end((err, res) => {
              expect(res.status).to.equal(400);
              expect(res.body.message).to
                .equal(`Enter a valid ${field}`);
              done();
            });
        });
      });

      it('should fail if password is less than 8', (done) => {
        superRequest.post('/users')
          .send(helper.invalidPasswordUser)
          .end((err, res) => {
            expect(res.status).to.equal(400);
            expect(res.body.message)
              .to.equal('Minimum of 8 characters is allowed for password');
            done();
          });
      });

      it('should not allow admin user to sign up', (done) => {
        helper.firstUser.roleId = 1;
        superRequest.post('/users')
          .send(helper.firstUser)
          .end((err, res) => {
            expect(res.status).to.equal(403);
            expect(res.body.message).to
              .equal('Permission denied, You cannot sign up as an admin user');
            done();
          });
      });
    });
  });

  describe('Existing users', () => {
    describe('Login /users/login', () => {
      it('should allow admin user to login', (done) => {
        superRequest.post('/users/login')
          .send(helper.adminUser)
          .end((err, res) => {
            adminToken = res.body.token;
            expect(res.status).to.equal(200);
            expect(res.body.token).to.not.equal(null);
            expect(res.body.message).to
              .equal('You have successfully logged in');
            done();
          });
      });

      it('should allow other users to login', (done) => {
        superRequest.post('/users/login')
          .send(helper.regularUser)
          .end((err, res) => {
            regularToken = res.body.token;
            expect(res.status).to.equal(200);
            expect(res.body.token).to.not.equal(null);
            expect(res.body.message).to
              .equal('You have successfully logged in');
            done();
          });
      });

      it('should not allow login with invalid password', (done) => {
        superRequest.post('/users/login')
          .send({ email: newAdminUser.email, password: 'invalid' })
          .end((err, res) => {
            expect(res.status).to.equal(401);
            expect(res.body.message).to
              .equal('Please enter a valid email or password to log in');
            done();
          });
      });

      it('should not allow login when email and password is not provided',
      (done) => {
        superRequest.post('/users/login')
          .send({ })
          .end((err, res) => {
            expect(res.status).to.equal(400);
            expect(res.body.message).to
              .equal('Please provide your email and password to login');
            done();
          });
      });
    });

    describe('Get all users, GET /users ', () => {
      it('should return verification failed if no token is supply', (done) => {
        superRequest.get('/users')
          .set({ })
          .end((err, res) => {
            expect(res.status).to.equal(400);
            expect(res.body.message).to
              .equal('Please sign in or register to get a token');
            done();
          });
      });

      it('should return invalid token if token is invalid', (done) => {
        superRequest.get('/users')
          .set({ 'x-access-token': 'hello-andela-tia' })
          .end((err, res) => {
            expect(res.status).to.equal(401);
            expect(res.body.message).to
              .equal('The token you supplied has expired');
            done();
          });
      });

      it(`should return users own profile,
      when the requester is a regular user`, (done) => {
        superRequest.get('/users')
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('You have successfully retrived all users');
            expect(res.body.users.rows[0].username).to
              .equal(helper.regularUser.username);
            done();
          });
      });

      it(`should return all users profile,
      when the requester is an admin user`, (done) => {
        superRequest.get('/users')
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('You have successfully retrived all users');
            done();
          });
      });
    });

    describe('Get user by Id GET /users/:id', () => {
      it('should return verification failed for unregistered user', (done) => {
        superRequest.get(`/users/${newAdminUser.id}`)
          .end((err, res) => {
            expect(res.status).to.equal(400);
            expect(res.body.message).to
              .equal('Please sign in or register to get a token');
            done();
          });
      });

      it('should return user\'s profile when valid user\'s id is supplied',
      (done) => {
        superRequest.get(`/users/${newAdminUser.id}`)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.user).to.not.equal(null);
            expect(res.body.user.id).to.equal(newAdminUser.id);
            expect(res.body.user.email).to.equal(newAdminUser.email);
            done();
          });
      });

      it('should return not found for invalid user id', (done) => {
        superRequest.get('/users/9999')
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(404);
            expect(res.body.message).to.equal('This user does not exist');
            done();
          });
      });
    });

    describe('Update user attributes PUT /users/:id', () => {
      it('should update user\'s profile when valid user token is supplied',
      (done) => {
        const updateData = {
          userName: 'Olawale',
          lastName: 'Aladeusi',
          password: 'newpassword'
        };
        superRequest.put(`/users/${regularUser.id}`)
          .send(updateData)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to.equal('Your profile has been updated');
            expect(res.body.updatedUser.userName).to.equal('Olawale');
            expect(res.body.updatedUser.lastName).to.equal('Aladeusi');
            done();
          });
      });

      it('should return error when updating with an existing username',
      (done) => {
        superRequest.put(`/users/${regularUser.id}`)
          .send({ userName: helper.adminUser.userName })
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(400);
            expect(res.body.errorArray[0].message)
              .to.equal('userName must be unique');
            done();
          });
      });

      it('should return error when a user want to update id',
      (done) => {
        superRequest.put(`/users/${regularUser.id}`)
          .send({ id: 10 })
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(403);
            expect(res.body.message)
              .to.equal('You are not permitted to update your id');
            done();
          });
      });

      it('should return not found for invalid user id', (done) => {
        const data = { username: 'wale', lastname: 'ala' };
        superRequest.put('/users/99999')
          .send(data)
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(404);
            expect(res.body.message).to.equal('This user does not exist');
            done();
          });
      });

      it(`should return permission denied when regular user want to
        update another user's profile`, (done) => {
        const data = { userName: 'wale', lastName: 'ala' };
        superRequest.put(`/users/${newAdminUser.id}`)
          .send(data)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(401);
            expect(res.body.message).to
              .equal('You are not permitted to update this profile');
            done();
          });
      });

      it('should give admin permission to update any user\'s profile',
      (done) => {
        const data = { userName: 'wale', lastName: 'ala' };
        superRequest.put(`/users/${regularUser.id}`)
          .send(data)
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('Your profile has been updated');
            expect(res.body.updatedUser.userName).to.equal('wale');
            expect(res.body.updatedUser.lastName).to.equal('ala');
            done();
          });
      });
    });

    describe('Delete user DELETE /users/:id', () => {
      let newUser, newUSerToken;
      before((done) => {
        superRequest.post('/users')
          .send(helper.thirdUser)
          .end((err, res) => {
            newUser = res.body.user;
            newUSerToken = res.body.token;
            done();
          });
      });

      it('should return not found for invalid user id', (done) => {
        superRequest.delete('/users/999')
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.body.message).to.equal('This user does not exist');
            expect(res.status).to.equal(404);
            done();
          });
      });

      it('should fail when request is from a regular user', (done) => {
        superRequest.delete(`/users/${regularUser.id}`)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(403);
            expect(res.body.message).to
              .equal('You are not permitted to perform this action');
            done();
          });
      });

      it('allow admin to delete a user', (done) => {
        superRequest.delete(`/users/${newUser.id}`)
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('This account has been successfully deleted');
            done();
          });
      });

      it('should not allow a deleted user to access any restricted route',
      (done) => {
        superRequest.get('/users/')
          .set({ 'x-access-token': newUSerToken })
          .end((err, res) => {
            expect(res.status).to.equal(404);
            expect(res.body.message).to
              .equal('Account not found, Sign Up or sign in to get access');
            done();
          });
      });
    });

    describe('Logout', () => {
      it('should logout successfully', (done) => {
        superRequest.post('/users/logout')
        .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('You have successfully logged out');
            done();
          });
      });
    });
  });
});
